"use client";

import * as snarkjs from 'snarkjs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename);

const wasmPath = path.join(__dirname, 'signature_circuit_js','signature_circuit.wasm');
const zkeyPath = path.join(__dirname, 'circuit_final.zkey');
const verifyPath=path.join(__dirname,"verification_key.json")





export function detectWallets() {

  if (typeof window === 'undefined') {
    return [];
  }

  const wallets= [];
  if (window.phantom?.solana || window.solana) wallets.push('phantom');
  if (window.backpack) wallets.push('backpack');
  if (window.solflare) wallets.push('solflare');

  return wallets
}


const url ="VELOCITYINFRA/x401_auth"
const path=new URL("VELOCITYINFRA/x401_auth").pathname;




async function getNonce() {

        const res = await fetch(url,{
            mode:"cors",
            method:"get",
            cache:"no-cache",
            headers:{
                    "content-type":"application/json"
                    }
        });
      
        const data = await res.json();
        const nonce = res.headers.get("X-401-Nonce") || "";
        const mechanism = res.headers.get("X-401-Mechanism");
        console.log("Nonce:", nonce, "Mechanism:", mechanism);
        console.log("Initial response:", data);
        return nonce;
    }




function buildSigningPayload(nonce) {

        return `CHALLENGE::${nonce}::${path}::VELOCITY401`;

    }


async function signPayload(payload,wallet) {

        if (wallet=="phantom"){

                await window.phantom.solana.connect()

                const encoded = new TextEncoder().encode(payload);

                const signed = await (window).phantom.solana.signMessage(encoded, "utf8");

                return {
                    signature: signed.signature,
                    publicKey: signed.publicKey.toString()
            };
            
            }
        else if (wallet=="solflare"){


                await window.solflare.solana.connect()

                const encoded = new TextEncoder().encode(payload);

                const signed = await (window).solflare.solana.signMessage(encoded, "utf8");

                return {
                    signature: signed.signature,
                    publicKey: signed.publicKey.toString()
            };
            
            }



}






export default async function VelocityzkProofCreation(){



    try {



    console.log("Starting authentication...");
      
    const nonce = await getNonce();
    console.log("Got nonce:", nonce);
    if (!nonce) {
        console.error("Failed to get nonce!");
        return;
    }

     console.log("Building payload...");
     const payload = buildSigningPayload(nonce);

     console.log("Requesting signature from wallet...");
     const { signature, publicKey } = await signPayload(payload,config.wallet);
     

     const vKey = JSON.parse(fs.readFileSync(verifyPath, 'utf8'));
     console.log("Starting verification...");
     const startTime = Date.now();
    

      const sigBytes = Array.from(signature);
      const sig1 = BigInt(sigBytes[0]);
      const sig2 = BigInt(sigBytes[1]);
      const sig3 = BigInt(sigBytes[2]);
      const sig4 = BigInt(sigBytes[3]);


      const sig1Sq = sig1 * sig1;
      const sig2Sq = sig2 * sig2;
      const sig3Sq = sig3 * sig3;
      const sig4Sq = sig4 * sig4;
      const hash1 = sig1Sq + sig2Sq;
      const hash2 = sig3Sq + sig4Sq;
      const publicHash = hash1 + hash2;

    console.log("Public hash:", publicHash.toString());
    const input = {
        sig1: sig1.toString(),
        sig2: sig2.toString(),
        sig3: sig3.toString(),
        sig4: sig4.toString(),
        publicHash: publicHash.toString()
      };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
              input,
              wasmPath,
              zkeyPath
            );
      
    console.log("ZK Proof generated!");

    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
    const endTime = Date.now();
    console.log(`Verification complete in ${endTime - startTime}ms:`, isValid);
    
     return {
          valid: isValid,
          wallet:publicKey,
          verificationTime: endTime - startTime,
          message: isValid ? "ZK proof verified!" : "Invalid proof"
        }


      }catch(e){
        
         return {
          valid: false,
          wallet:null,
          verificationTime:null,
          message: e
        }

      }
   

}
