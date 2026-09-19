from typing import Dict, List, Optional
from pydantic import BaseModel

class CommandDefinition(BaseModel):
    intent: str
    display_name: str
    default_text: str
    supported_modalities: List[str]

COMMAND_REGISTRY: Dict[str, CommandDefinition] = {
    "YES": CommandDefinition(
        intent="YES",
        display_name="Yes",
        default_text="Yes, I agree.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "NO": CommandDefinition(
        intent="NO",
        display_name="No",
        default_text="No, I disagree.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "HELP": CommandDefinition(
        intent="HELP",
        display_name="Help",
        default_text="I need assistance.",
        supported_modalities=["lip", "speech"],
    ),
    "STOP": CommandDefinition(
        intent="STOP",
        display_name="Stop",
        default_text="Please pause or stop here.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "THANK_YOU": CommandDefinition(
        intent="THANK_YOU",
        display_name="Thank You",
        default_text="Thank you.",
        supported_modalities=["lip", "speech"],
    ),
    "REQUEST_TO_SPEAK": CommandDefinition(
        intent="REQUEST_TO_SPEAK",
        display_name="I Want to Speak",
        default_text="I would like to speak.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "QUESTION": CommandDefinition(
        intent="QUESTION",
        display_name="I Have a Question",
        default_text="I have a question regarding this.",
        supported_modalities=["lip", "speech"],
    ),
    "PLEASE_REPEAT": CommandDefinition(
        intent="PLEASE_REPEAT",
        display_name="Please Repeat",
        default_text="Could you please repeat that?",
        supported_modalities=["lip", "speech"],
    ),
    "NEXT_TOPIC": CommandDefinition(
        intent="NEXT_TOPIC",
        display_name="Next Topic",
        default_text="Let's move on to the next topic.",
        supported_modalities=["lip", "speech"],
    ),
    "AGREE": CommandDefinition(
        intent="AGREE",
        display_name="Agree",
        default_text="I agree with this point.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "DISAGREE": CommandDefinition(
        intent="DISAGREE",
        display_name="Disagree",
        default_text="I have concerns regarding this.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "FREEFORM_SPEECH": CommandDefinition(
        intent="FREEFORM_SPEECH",
        display_name="Spoken Message",
        default_text="",
        supported_modalities=["speech"],
    ),
}

def get_command_by_intent(intent: str) -> Optional[CommandDefinition]:
    return COMMAND_REGISTRY.get(intent)
