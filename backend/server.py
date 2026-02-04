from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str  # "blok_nasional", "sirine_kerja", "reminder"
    event_time: str
    description: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivityLogCreate(BaseModel):
    event_type: str
    event_time: str
    description: str

# Routes
@api_router.get("/")
async def root():
    return {"message": "Sinarmas Reminder System API"}

@api_router.post("/activity-log", response_model=ActivityLog)
async def create_activity_log(input: ActivityLogCreate):
    log_dict = input.model_dump()
    log_obj = ActivityLog(**log_dict)
    
    doc = log_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.activity_logs.insert_one(doc)
    return log_obj

@api_router.get("/activity-log", response_model=List[ActivityLog])
async def get_activity_logs():
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    
    for log in logs:
        if isinstance(log['timestamp'], str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    
    return logs

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()