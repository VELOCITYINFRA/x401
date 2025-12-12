from fastapi import FastAPI,Request,HTTPException,Response
from pydantic import BaseModel
from fastapi.responses import JSONResponse
import uuid
from fastapi.middleware.cors import CORSMiddleware
import json
import base64
from components.middleware import x401Kit
from components.mongodbconnection import provideClient
import hashlib
import secrets



app=FastAPI()
dbclient=provideClient()
db=dbclient["sdklogs_db"]
col=db["sdklogs_col"]






origins=["*"]



app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
)




app.add_middleware(
    x401Kit,
    protected_paths=[
        "/x401_auth"
    ]
)


def generate_sha256_hex_challenge():
    random_data = secrets.token_bytes(32)
    challenge = hashlib.sha256(random_data).hexdigest()
    return challenge



@app.get("/x401_auth")
def Auth401(request:Request):
    return {"token":""}



@app.get("/x401_web_auth_challange")
def WebAuthChallange(request:Request):
    challange=generate_sha256_hex_challenge()
    return {"challange":challange}



@app.get("/sdklogs/{id}")
def SDKLog(id):
    document=col.find_one({"owner":"system"})
    details=None
    if document:
        logs=document["logs"]
        for data in logs:
            if data.signer==id:
                details=data
                
    return JSONResponse(content={"details":details})
        
