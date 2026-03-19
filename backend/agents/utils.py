# agents/utils.py
import uuid
import base64
import logging
import json
from typing import Any, Tuple, Optional, List, Dict

# --- Agno Imports ---
from agno.media import Image, File as AgnoFile
from agno.models.message import Message

# --- AG-UI Imports ---
from ag_ui.core import RunAgentInput

# Configure Logger
logger = logging.getLogger(__name__)

def safe_serialize(obj: Any) -> Any:
    """
    Recursively converts Agno/Pydantic/Complex objects into JSON-safe dictionaries or strings.
    """


    if obj is None: 
        return None
    
    if isinstance(obj, (str, int, float, bool)): 
        return obj
    
    if isinstance(obj, uuid.UUID): 
        return str(obj)
    
    if isinstance(obj, (list, tuple)): 
        return [safe_serialize(i) for i in obj]
    
    if isinstance(obj, dict): 
        return {k: safe_serialize(v) for k, v in obj.items()}
    
    # Pydantic v2
    if hasattr(obj, "model_dump"): 
        return safe_serialize(obj.model_dump())
    
    # Agno / Legacy
    if hasattr(obj, "to_dict"): 
        return safe_serialize(obj.to_dict())
    
    # Generic Class
    if hasattr(obj, "__dict__"): 
        return safe_serialize(obj.__dict__)
    
    # Fallback
    return str(obj)

def safe_get(obj: Any, key: str, default: Any = None) -> Any:
    """
    Safely retrieves a value from a dict or object attribute.
    """
    if isinstance(obj, dict): 
        return obj.get(key, default)
    return getattr(obj, key, default)


def extract_ui_attachment_metadata(input_data: RunAgentInput) -> List[Dict[str, str]]:
    attachments: List[Dict[str, str]] = []
    messages = input_data.messages or []
    if not messages:
        return attachments

    last_message = messages[-1]
    content = safe_get(last_message, "content")
    image_previews: List[str] = []
    if isinstance(content, list):
        for item in content:
            if safe_get(item, "type") != "binary":
                continue
            mime = str(safe_get(item, "mimeType") or "application/octet-stream")
            data = safe_get(item, "data")
            if not mime.startswith("image/") or not isinstance(data, str) or not data:
                continue
            image_previews.append(f"data:{mime};base64,{data}")

    explicit_attachment_meta = safe_get(last_message, "attachmentsMeta")
    if isinstance(explicit_attachment_meta, list) and explicit_attachment_meta:
        image_index = 0
        for item in explicit_attachment_meta:
            attachment_type = str(safe_get(item, "type") or "file")
            attachment: Dict[str, str] = {
                "id": str(safe_get(item, "id") or ""),
                "name": str(safe_get(item, "name") or f"upload_{uuid.uuid4().hex[:8]}"),
                "content_type": str(safe_get(item, "contentType") or "application/octet-stream"),
                "type": attachment_type,
            }
            if attachment_type == "image" and image_index < len(image_previews):
                attachment["preview_image"] = image_previews[image_index]
                image_index += 1
            attachments.append(attachment)
        return attachments

    if not isinstance(content, list):
        return attachments

    image_index = 0
    for item in content:
        if safe_get(item, "type") != "binary":
            continue

        mime = safe_get(item, "mimeType") or "application/octet-stream"
        filename = safe_get(item, "filename") or f"upload_{uuid.uuid4().hex[:8]}"
        attachment_type = "image" if str(mime).startswith("image/") else "file"
        attachment: Dict[str, str] = {
            "id": str(safe_get(item, "id") or ""),
            "name": str(filename),
            "content_type": str(mime),
            "type": attachment_type,
        }
        if attachment_type == "image" and image_index < len(image_previews):
            attachment["preview_image"] = image_previews[image_index]
            image_index += 1
        attachments.append(attachment)

    return attachments

def is_image_content(data: bytes) -> bool:
    """
    Checks magic numbers (file headers) to determine if bytes are an image.
    """
    is_img = False
    header_hex = data[:4].hex() if len(data) >= 4 else "too_short"
    
    if data.startswith(b'\x89PNG\r\n\x1a\n'): is_img = True  # PNG
    elif data.startswith(b'\xff\xd8\xff'): is_img = True     # JPG
    elif data.startswith(b'GIF8'): is_img = True             # GIF
    elif data.startswith(b'BM'): is_img = True               # BMP
    elif data.startswith(b'RIFF') and data[8:12] == b'WEBP': is_img = True # WEBP
    
    if is_img:
        logger.debug(f"🖼️ [Utils] Detected Image Magic Header: {header_hex}")
    
    return is_img

def parse_multimodal_input(input_data: RunAgentInput) -> Tuple[str, List[Any], List[Any]]:
    """
    Extracts text prompt, images, and files from the AG-UI input structure.
    
    Returns:
        (prompt_string, list_of_agno_images, list_of_agno_files)
    """
    logger.info(f"📥 [Utils] Parsing Multimodal Input for Thread: {input_data.thread_id}")
    
    prompt_parts = []
    images = []
    files = []

    messages = input_data.messages or []
    if not messages:
        logger.warning("   [Utils] No messages found in input.")
        return "", [], []

    # usually we process the last message for the current turn
    last_msg = messages[-1]
    logger.debug(f"   [Utils] Processing last message role: {safe_get(last_msg, 'role')}")
    
    content = safe_get(last_msg, 'content')
    
    # Case 1: Simple String
    if isinstance(content, str):
        logger.debug("   [Utils] Content is simple text.")
        return content, [], []
        
    # Case 2: Complex Content Array (Multimodal)
    if isinstance(content, list):
        logger.debug(f"   [Utils] Content is list of {len(content)} items.")
        
        for i, item in enumerate(content):
            itype = safe_get(item, "type")
            
            # --- TEXT ---
            if itype == "text":
                text_val = safe_get(item, "text")
                if text_val:
                    prompt_parts.append(str(text_val))
            
            # --- BINARY (Images/Files) ---
            elif itype == "binary":
                mime = safe_get(item, "mimeType") or "application/octet-stream"
                item_id = safe_get(item, "id") or ""
                filename = safe_get(item, "filename") or item_id or f"upload_{uuid.uuid4().hex[:8]}"
                
                # Check for Base64 Data
                data_b64 = safe_get(item, "data")
                
                if not data_b64:
                    logger.warning(f"   [Utils] Item {i} (Binary) has no 'data' field. Skipping.")
                    continue

                try:
                    logger.debug(f"   [Utils] Item {i}: Decoding {len(data_b64)} chars of Base64...")
                    decoded_data = base64.b64decode(data_b64)
                    
                    # Heuristics: Magic Numbers OR Mime Type
                    is_img = is_image_content(decoded_data)
                    if not is_img and mime.startswith("image/"):
                        is_img = True
                        logger.debug(f"   [Utils] Item {i}: Trusted MIME type '{mime}' as Image.")

                    if is_img:
                        logger.info(f"   [Utils] Item {i}: ✅ Recognized as IMAGE.")
                        # Agno Image Object
                        images.append(Image(content=decoded_data))
                    else:
                        logger.info(f"   [Utils] Item {i}: 📄 Recognized as FILE ({mime}).")
                        
                        # Ensure extension exists
                        ext = ""
                        if '.' in filename: 
                            ext = filename.split('.')[-1]
                        elif '/' in mime: 
                            ext = mime.split('/')[-1]
                        if not ext: ext = "bin"
                        
                        if not filename.endswith(f".{ext}"): 
                            filename += f".{ext}"

                        # Agno File Object
                        file_obj = AgnoFile(
                            content=decoded_data,
                            file_type=ext,
                            path=filename,
                            name=filename
                        )
                        # Inject extra metadata just in case
                        setattr(file_obj, 'mime_type', mime)
                        files.append(file_obj)

                except Exception as e:
                    logger.error(f"❌ [Utils] Failed to process binary item {i}: {e}")

    final_prompt = "\n".join(prompt_parts)
    logger.info(f"   [Utils] Extraction Complete. Prompt Length: {len(final_prompt)}, Images: {len(images)}, Files: {len(files)}")
    
    return final_prompt, images, files

def extract_tool_info(chunk: Any) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Robustly extracts tool call details (ID, Name, Args) from an Agno event chunk.
    Handles variations in Agno versions and object structures.
    
    Returns: (id, name, args)
    """
    logger.debug(f"🔍 [Utils] Extracting tool info from chunk: {type(chunk)}")

    # 1. Locate the Tool Object
    tc = getattr(chunk, "tool_call", None) or getattr(chunk, "tool", None)
    
    if not tc:
        logger.trace("   [Utils] No 'tool_call' or 'tool' attribute found.")
        return None, None, None

    # 2. Extract ID
    # Priority: id -> tool_call_id
    tc_id = getattr(tc, "id", None) or getattr(tc, "tool_call_id", None)
    if not tc_id:
        logger.warning("   [Utils] Tool object found but ID is missing. Using 'unknown_id'.")
        tc_id = "unknown_id"

    # 3. Extract Name
    # Priority: function.name -> tool_name -> name
    tc_name = "unknown_tool"
    
    if hasattr(tc, "function") and hasattr(tc.function, "name"):
        tc_name = tc.function.name
        logger.debug(f"   [Utils] Found name via tc.function.name: {tc_name}")
    elif hasattr(tc, "tool_name"):
        tc_name = tc.tool_name
        logger.debug(f"   [Utils] Found name via tc.tool_name: {tc_name}")
    elif hasattr(tc, "name"):
        tc_name = tc.name
        logger.debug(f"   [Utils] Found name via tc.name: {tc_name}")

    # 4. Extract Arguments
    # Priority: function.arguments -> tool_args -> arguments
    tc_args = None
    
    if hasattr(tc, "function") and hasattr(tc.function, "arguments"):
        tc_args = tc.function.arguments
        logger.debug("   [Utils] Found args via tc.function.arguments")
    elif hasattr(tc, "tool_args"):
        tc_args = tc.tool_args
        logger.debug("   [Utils] Found args via tc.tool_args")
    elif hasattr(tc, "arguments"):
        tc_args = tc.arguments
        logger.debug("   [Utils] Found args via tc.arguments")

    return tc_id, tc_name, tc_args


def build_branch_history_messages(input_messages: List[Any]) -> List[Message]:
    branch_messages: List[Message] = []

    for raw_message in input_messages or []:
        role = safe_get(raw_message, "role")
        if role not in {"user", "assistant", "system"}:
            continue

        content = safe_get(raw_message, "content")
        text_parts: List[str] = []

        if isinstance(content, str):
            if content.strip():
                text_parts.append(content.strip())
        elif isinstance(content, list):
            for item in content:
                if safe_get(item, "type") != "text":
                    continue
                text_value = safe_get(item, "text")
                if text_value:
                    text_parts.append(str(text_value).strip())

        text_content = "\n".join(part for part in text_parts if part)
        if not text_content:
            continue

        branch_messages.append(Message(role=role, content=text_content))

    return branch_messages


def build_branch_history_prompt(input_messages: List[Any]) -> str:
    if not input_messages or len(input_messages) <= 1:
        return ""

    transcript_lines: List[str] = []
    for raw_message in input_messages[:-1]:
        role = safe_get(raw_message, "role")
        if role not in {"user", "assistant"}:
            continue

        content = safe_get(raw_message, "content")
        text_parts: List[str] = []

        if isinstance(content, str):
            if content.strip():
                text_parts.append(content.strip())
        elif isinstance(content, list):
            for item in content:
                if safe_get(item, "type") != "text":
                    continue
                text_value = safe_get(item, "text")
                if text_value:
                    text_parts.append(str(text_value).strip())

        text_content = "\n".join(part for part in text_parts if part)
        if not text_content:
            continue

        speaker = "User" if role == "user" else "Assistant"
        transcript_lines.append(f"{speaker}: {text_content}")

    if not transcript_lines:
        return ""

    return (
        "<active_branch_history>\n"
        "Use only this conversation branch as the prior chat history for the current turn.\n"
        "Ignore messages from any sibling or edited-away branches.\n\n"
        f"{chr(10).join(transcript_lines)}\n"
        "</active_branch_history>"
    )
