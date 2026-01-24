import uvicorn
import os
os.chdir(r"C:\inetpub\sarraf\backend")
uvicorn.run("server:app", host="127.0.0.1", port=8001)
