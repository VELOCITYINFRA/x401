"use client"
import bs58 from "bs58";

import { 
    startRegistration, 
    startAuthentication,
    browserSupportsWebAuthn 
} from '@simplewebauthn/browser';

import { BrowserProvider } from "ethers";




async function registerWebAuthn(optionsJSON) {

    if (!browserSupportsWebAuthn()) {
        console.error("WebAuthn is not supported in this browser.");
        return null;
    }

    try {
        const attestationResponse = await startRegistration(optionsJSON);
        console.log(attestationResponse)
        return attestationResponse;
    } catch (error) {
        console.error("WebAuthn Registration Error:", error);
        if (error.name === 'NotAllowedError') {
            console.log("Registration cancelled by user or permission denied.");
        } else {
            console.log(`Registration failed: ${error.message}`);
        }
        return null;
    }
}


async function signMessageWebAuthn(optionsJSON) {
    if (!browserSupportsWebAuthn()) {
        console.error("WebAuthn is not supported in this browser.");
        return null;
    }

    try {
        const assertionResponse = await startAuthentication(optionsJSON);

        return assertionResponse;
    } catch (error) {
        console.error("WebAuthn Signing Error:", error);
        if (error.name === 'NotAllowedError') {
            alert("Signing cancelled by user or permission denied.");
        } else {
            alert(`Signing failed: ${error.message}`);
        }
        return null;
    }
}













export function getGeolocationData() {
    // 1. Return a Promise immediately
    return new Promise((resolve, reject) => { 
        if (!navigator.geolocation) {
            // Resolve the Promise with the error object
            resolve({
                latitude: null,
                longitude: null,
                error: 'Geolocation not supported by this browser.',
                isFetching: false,
            });
            return;
        }

        const success = (position) => {
            const { latitude, longitude } = position.coords;
            // 2. When location is found, resolve the Promise with the data
            resolve({
                latitude: latitude,
                longitude: longitude,
                error: null,
                isFetching: false,
            });
        };

        const error = (err) => {
            let errorMessage;
            if (err.code === 1) {
                errorMessage = "Permission Denied: Location access was blocked.";
            } else {
                errorMessage = `Error (${err.code}): ${err.message}`;
            }
            // 3. If there's an error, resolve the Promise with the error object
            resolve({
                latitude: null,
                longitude: null,
                error: errorMessage,
                isFetching: false,
            });
        };

        // 4. Start the browser's asynchronous request
        navigator.geolocation.getCurrentPosition(success, error, {
            enableHighAccuracy: true,
            timeout: 5000,
        });
    });
}




export function detectWallets() {

  if (typeof window === 'undefined') {
    return [];
  }

  const wallets= [];
  if (window.phantom?.solana || window.solana) wallets.push('phantom');
  if (window.backpack) wallets.push('backpack');
  if (window.solflare) wallets.push('solflare');
  if (window.ethereum) wallets.push("metamask")

  return wallets
}

        
const url ="VELOCITYINFRA/x401_auth"
const path=new URL("VELOCITYINFRA/x401_auth").pathname;

const challange_path="VELOCITYINFRA/x401_web_auth_challange";



async function getChallange(){


    
        let request=await fetch(challange_path,{
            method:"get",
            mode:"cors",
            headers:{
                "content-type":"application/json"
            }

        })
        let challangeobj=await request.json()
        let payload=challangeobj.challange
        return payload

}

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
             else if (wallet == "metamask") {
                const provider = new BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const signature = await signer.signMessage(payload);
                const address = await signer.getAddress();

                return {
                        signature:  Uint8Array.from(Buffer.from(signature, "hex")),
                        publicKey: address
                    };

                }




}











export async function VelocityAuth(config) {


    
let registeredCredentialIdBase64URL=null       

if(config.device_auth){
  
            let vwauth=localStorage.getItem("v_wauth")

            if(!vwauth){

                let CHALLENGE=await getChallange()
                localStorage.setItem("v_wauth_challange",CHALLENGE)

                let userIdEncoded ="velocityuser"
                let optionsJSON={

                    rp: { id: window.location.hostname,name: "Velocity Infra WebAuthn"},
                    user: { id: userIdEncoded,name: "velocityinfra",displayName: "velocityuser"},
                    challenge:CHALLENGE,
                    pubKeyCredParams: [ { type: "public-key", alg: -7 }],
                    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required",residentKey: "required"},
                    timeout: 60000,
                    attestation: "none"
                    };



                let registerresponse=await registerWebAuthn(optionsJSON)
                registeredCredentialIdBase64URL = registerresponse.id
                localStorage.setItem("v_wauth",registeredCredentialIdBase64URL)
                console.log(`✅ Registration Success! ID stored: ${registerresponse.id}`);
            }


          

            const CHALLENGE= localStorage.getItem("v_wauth_challange")

            const publicKeyCredentialRequestOptions = {
                    challenge:CHALLENGE,
                    rpId: window.location.hostname, 
                    allowCredentials: [{
                        id: registeredCredentialIdBase64URL,
                        type: 'public-key'
                    }],
            
                authenticatorSelection: {
                    authenticatorAttachment: "platform"
                },
                userVerification: "required"
            };
            let signresult=await signMessageWebAuthn(publicKeyCredentialRequestOptions)
            if (signresult!==null){

                    console.log("Starting authentication...");
                    const nonce = await getNonce();
                    console.log("Got nonce:", nonce);
                    if (!nonce) {
                        console.error("Failed to get nonce!");
                        return;
                    }

                    console.log("Building payload...");
                    const payload = buildSigningPayload(nonce);

                    const { signature, publicKey } = await signPayload(payload,config.wallet);
                    const signatureBase58 = bs58.encode(signature);
                    console.log("Signature:", signatureBase58);
                    console.log("Public Key:", publicKey);
                    console.log("Sending authenticated request...");

                    const res = await fetch(url, {
                            mode:"cors",
                            method:"get",
                            cache:"no-store",
                        headers: {

                            "X-401-Nonce":nonce,
                            "X-401-Signature":signatureBase58,
                            "X-401-Addr": publicKey,
                            "X-Lat":config.coords.latitude,
                            "X-Long":config.coords.longitude,
                            "required_mint":config.required_mint,
                            "mint_amount":config.mint_amount,
                            "helius_api_key":"",
                            "geo_code":config.geo_code,
                            "geo_code_locs":config.geo_code_locs, 
                             "eth":config.wallet =="ethereum"?"true":"false"
                        }
                    });

                const data = await res.json();
                if (res.status==500 && data.status=="locerror"){

                        return {
                            success: false,
                            error: "LOCATION_ERROR",
                            message: "Location access error"
                        };
            
                    }
                else if(res.status==500){
                        return {
                            success: false,
                            error: "INSUFFICIENT_TOKENS",
                            message: `You need ${config.mint_amount}tokens to access the platform`,
                            required: config.mint_amount
                    };

                }
                else if (res.status==401 && data.status=="locdeny"){

                        return {
                            success: false,
                            error: "LOCATION_DENIED",
                            message: "Access denied for your location"
                        };

                }
       
                else if(res.status==200) {

                    return {
                            success: true,
                            alreadyAuthenticated: false,
                            token: data.token,
                            data: data
                        };
                    }




                
            }


} else {

        const issued_jwt=localStorage.getItem("vjwt")


        if(issued_jwt){

            const res = await fetch(url, {
            mode:"cors",
            method:"get",
            cache:"no-store",
            headers:{
                "content-type":"application/json",
                "x-jwt":issued_jwt
            }
        });

        const data = await res.json();

    
        return {
                success: true,
                alreadyAuthenticated: true,
    
        };




        }
        else   {        

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


        const signatureBase58 = bs58.encode(signature);
        console.log("Signature:", signatureBase58);
        console.log("Public Key:", publicKey);

        console.log("Sending authenticated request...");

       


        const res = await fetch(url, {
            mode:"cors",
            method:"get",
            cache:"no-store",

        
            headers: {

                "X-401-Nonce":nonce,
                "X-401-Signature":signatureBase58,
                "X-401-Addr": publicKey,
                "X-Lat":config.coords.latitude,
                "X-Long":config.coords.longitude,
                "required_mint":config.required_mint,
                "mint_amount":config.mint_amount,
                "helius_api_key":"",
                "geo_code":config.geo_code,
                "geo_code_locs":config.geo_code_locs,
                 "eth":config.wallet =="ethereum"?"true":"false"
                
            }
        });

        const data = await res.json();

        if (res.status==500 && data.status=="locerror"){

            return {
                success: false,
                error: "LOCATION_ERROR",
                message: "Location access error"
            };
            
        }
        else if(res.status==500){
              return {
                success: false,
                error: "INSUFFICIENT_TOKENS",
                message: `You need ${config.mint_amount}tokens to access the platform`,
                required: config.mint_amount
            };

        }
        else if (res.status==401 && data.status=="locdeny"){

            return {
                success: false,
                error: "LOCATION_DENIED",
                message: "Access denied for your location"
            };

        }
       
        else if(res.status==200) {

           

              return {
                success: true,
                alreadyAuthenticated: false,
                token: data.token,
                data: data
            };


    }

}

}
    

}


