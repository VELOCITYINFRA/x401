from fastapi import Request 
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError
import hashlib
import secrets
import base58
import requests
import json
import httpx
import jwt
from jwt.exceptions import (
    ExpiredSignatureError, 
    InvalidAudienceError, 
    InvalidSignatureError, 
    DecodeError
)


import datetime
import time

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderServiceError
from .mongodbconnection import provideClient




geolocator = Nominatim(user_agent="velocity")
dbclient=provideClient()
db=dbclient["sdklogs_db"]
col=dbclient["sdklogs_col"]




def GEOCODER(coords):
    try:
        lat = coords.get("latitude")
        lon = coords.get("longitude")

        if lat is None or lon is None:
            return {
                "status": "error",
                "message": "Missing latitude or longitude.",
                "data": None
            }

        location = geolocator.reverse(f"{lat}, {lon}", exactly_one=True)

        if location and "address" in location.raw:
            country_name = location.raw["address"].get("country")
            country_code = location.raw["address"].get("country_code")

            return {
                "status": "success",
                "message": "Location resolved successfully.",
                "data": {
                    "country": country_name,
                    "code": country_code.upper() if country_code else None
                }
            }

        return {
            "status": "not_found",
            "message": "Location could not be resolved.",
            "data": None
        }

    except GeocoderServiceError as e:
        return {
            "status": "error",
            "message": f"Geocoding service error: {str(e)}",
            "data": None
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Unexpected error: {str(e)}",
            "data": None
        }




def SignatureVerification(X_401_Addr,X_401_Nonce,X_401_Sign,challange):

    
            if X_401_Addr and X_401_Nonce and X_401_Sign:

                try:

                    signature_bytes = base58.b58decode(X_401_Sign)
                    verify_key = VerifyKey(base58.b58decode(X_401_Addr))
                    payload_bytes = challange.encode("utf-8")
    
                    verify_key.verify(payload_bytes, signature_bytes)
                    return True
                         
                except BadSignatureError:
                    
                    return False



def SecretNonceGenerator():
        random_bytes = secrets.token_bytes(32)
        return hashlib.sha256(random_bytes).hexdigest()




def generateJWT(wallet,aud):

    EXPIRY_DURATION = datetime.timedelta(days=3)
    try:
    
        payload = {
            
            "sub": wallet,
            "aud":aud,
            "issuer":"velocity401",
            "exp": datetime.datetime.utcnow() + EXPIRY_DURATION, 
            "iat": datetime.datetime.utcnow()
            
        }

        token = jwt.encode(payload, "jwttoken", algorithm="HS256")

        return token
    except Exception as e:
         
        return None




def verifyJWT(token_string,aud):

    try:
        payload = jwt.decode(
            token_string, 
            "jwttoken", 
            algorithms=["HS256"],
            audience=aud,
            issuer="velocity401" 
        )
        
        wallet_address = payload.get("sub")
        print(f"✅ Token valid for wallet: {wallet_address}")
        return wallet_address
        
    except ExpiredSignatureError:
        print("🚨 Token rejected: Signature has expired.")
        return None
    except InvalidAudienceError:
        print(f"🚨 Token rejected: Invalid audience. Expected '{EXPECTED_AUDIENCE}'.")
        return None
    except InvalidSignatureError:
        print("🚨 Token rejected: Invalid signature (key mismatch).")
        return None
    except DecodeError as e:
        print(f"🚨 Token rejected: Malformed JWT structure. Error: {e}")
        return None
    except Exception as e:
        print(f"⚠️ An unexpected error occurred during verification: {e}")
        return None




        


def TokenCheck(walletPublicKey,required_mint,mint_amount):
    
        url = f"https://mainnet.helius-rpc.com/?api-key=<apikeyhere>"
        payload = {
            "jsonrpc": "2.0",
            "id": "1",
            "method": "getTokenAccountsByOwner",
            "params": [
                walletPublicKey,
                {"mint":required_mint},
                {"encoding": "jsonParsed"}
            ]
        }
    
        headers = {"Content-Type": "application/json"}
    
        try:
            
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            
        except requests.exceptions.RequestException as e:
            
            return {"status": False, "message": f"API Request Failed: {e}"}

    
        token_accounts = data.get("result", {}).get("value")

        if not token_accounts:
        
            return False
    
        try:
            
            account_info = token_accounts[0]["account"]["data"]["parsed"]["info"]
            token_amount = account_info["tokenAmount"]
            ui_amount = float(token_amount.get("uiAmount"))
            
        except (TypeError, KeyError, IndexError):

            return {"status": False, "message": "Could not parse token account data"}

        if ui_amount >= mint_amount:
            
            print(ui_amount)
            print(True)
            return True
            
        else:
            print(ui_amount)
            return False









class x401Kit(BaseHTTPMiddleware):


    def __init__(self, app,protected_paths:list):
        super().__init__(app)
        self.protected_paths = protected_paths
     
        


    async def dispatch(self, request: Request, call_next):
            


            if request.method == "OPTIONS":
                return await call_next(request)
            
            if not any(request.url.path.startswith(p) for p in self.protected_paths):
                return await call_next(request)
        


            NONCE=SecretNonceGenerator()
            
            X_401_Nonce=request.headers.get("X-401-Nonce")
            X_401_Sign=request.headers.get("X-401-Signature")
            X_401_Addr=request.headers.get("X-401-Addr")
            lat=request.headers.get("X-Lat")
            long=request.headers.get("X-Long")
            client_jwt=request.headers.get("x-jwt")
            aud=request.headers.get("origin")

        
          


        
            coords={
                                 
                "latitude":lat,
                "longitude":long
                
                }

            
        
           
            REQUIRED_SERVICE=None
            

            if client_jwt:
                        decoded=verifyJWT(client_jwt,aud)
                        return JSONResponse(
                                content={"status":"identified","token":X_401_Addr,"message":"identified already"},
                                status_code=200,
                                headers={
    
                                     "Access-Control-Allow-Origin": "*",
                                    "Access-Control-Allow-Credentials": "true"                        
                            
                                }
                                )


            
                
            if not X_401_Addr and not X_401_Nonce and not X_401_Sign :

                payload401={
                            
                        "X-401-Status":"Authrequired",
                        "x-401-Mechanism":"SOLANA",
                        "X-401-Nonce":NONCE,
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Expose-Headers": "x-401-Nonce, x-401-Mechanism, x-401-Status"
                }
    
                return JSONResponse(content={
                    
                    
                        "message":"401 Auth Required",
                        "information":"Non persistant stateless auth",
                        "issuer":"velocityinfra"
                
                },headers=payload401,status_code=401)
        



            required_mint = request.headers.get("required_mint")
            mint_amount=float(request.headers.get("mint_amount"))
            print(mint_amount)
            helius_api_key = request.headers.get("helius_api_key")
            geo_code=request.headers.get("geo_code")
            geo_code_locs=[request.headers.get("geo_code_locs")]

           
        

            challange=f"CHALLENGE::{X_401_Nonce}::{request.url.path}::VELOCITY401"

            signverify=SignatureVerification(X_401_Addr,X_401_Nonce,X_401_Sign,challange)
            tokenverify=TokenCheck(X_401_Addr,required_mint,mint_amount)
            
            print(tokenverify)


            sdkpayload={
                
                "signer":X_401_Addr,
                 "challange":challange,
                "token_amount":mint_amount,
                "required_mint":required_mint,
                "sign_verification":signverify,
                "token_verification":tokenverify,
                "geo_code":geo_code,
                "restricted_loc":geo_code_locs
                
            }

            if signverify == True and tokenverify == True:


                        if geo_code=="true":
                            
                            country=GEOCODER(coords)
                            print(country)
                            sdkpayload["geography"]=country
                            
                            if country["data"] is None:
                                 return JSONResponse(
                                      
                                        content={"status": "locerror", "message": f"Auth error"},
                                        headers= {
                                                "Access-Control-Allow-Origin": "*",
                                                "Access-Control-Allow-Credentials": "true"
                                            },
                                            status_code=500
                                            )
                                    
                                 
                            if country["data"]["code"] in geo_code_locs:
                                
                                 return JSONResponse(
                                            content={"status": "locdeny", "message":f"access denied for {country['data']['country']}"},
                                            headers= {
                                                "Access-Control-Allow-Origin": "*",
                                                "Access-Control-Allow-Credentials": "true"
                                            },
                                            status_code=401
                                            )

                        coll.find_one_and_update(
                            {"owner":"system"},
                            {
                                "$push":{
                                    "logs":sdkpayload
                                }
                            })    
                    
                        response = await call_next(request)



                       


                
                        if response.headers.get("content-type") == "application/json":



                           

                            
                            
                            body_bytes = b""
                            async for chunk in response.body_iterator:
                                body_bytes += chunk

                            try:
                                data = json.loads(body_bytes.decode())
                            except json.JSONDecodeError:
                                return response


                            JWTTOKEN=generateJWT(X_401_Addr,aud)
                            data["token"] = JWTTOKEN
        
                            response_headers = dict(response.headers)
                            response_headers.pop("content-length", None)
                            print(data) 

                            return JSONResponse(
                                    content=data,
                                    status_code=response.status_code,
                                    headers=response_headers
                                    )


                        return response
                                                    

            elif tokenverify==False:
                        return JSONResponse(
                            content={"status": "error", "message": "Missing required token"},
                            status_code=500,
                            headers={
                                   "Access-Control-Allow-Origin": "*",
                                "Access-Control-Allow-Credentials": "true"
                            }
                            
                            )
                            
            elif signverify==False:
                        print("failed")
                        return JSONResponse(
                            content={"status": "error", "message": "bad signature"},
                            status_code=500,
                              headers={
                                   "Access-Control-Allow-Origin": "*",
                                    "Access-Control-Allow-Credentials": "true"
                            })
            


            else:
                        return JSONResponse(
                            content={"status": "error", "message": "Authentication failed"},
                            status_code=500,
                            headers={
                                "Access-Control-Allow-Origin": "*",
                                "Access-Control-Allow-Credentials": "true"
                        })
