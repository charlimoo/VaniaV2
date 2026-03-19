import json
import logging
import time
from dataclasses import dataclass

from django.conf import settings
from django.utils import timezone

from .models import GoogleCalendarConnection

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]


@dataclass
class MeetEventResult:
    event_id: str
    meet_link: str
    attendee_emails: list[str]


class GoogleCalendarService:
    def get_config(self) -> GoogleCalendarConnection:
        return GoogleCalendarConnection.get_solo()

    def get_credentials(self):
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        config = self.get_config()
        if not config.token_json:
            return None

        creds = Credentials.from_authorized_user_info(config.token_json, SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            config.token_json = json.loads(creds.to_json())
            config.is_connected = True
            config.save(update_fields=["token_json", "is_connected", "updated_at"])

        return creds

    def create_meet_event(
        self,
        *,
        summary: str,
        description: str,
        started_at,
        ends_at,
        attendee_emails: list[str] | None = None,
    ) -> MeetEventResult:
        from googleapiclient.discovery import build

        creds = self.get_credentials()
        config = self.get_config()
        if not creds:
            raise ValueError("Google Calendar is not connected.")

        service = build("calendar", "v3", credentials=creds)
        attendee_emails = attendee_emails or []
        attendees = [{"email": email} for email in attendee_emails if email]
        request_id = f"vania-meet-{int(time.time() * 1000)}"

        event_body = {
            "summary": summary,
            "description": description,
            "start": {
                "dateTime": timezone.localtime(started_at).isoformat(),
                "timeZone": settings.TIME_ZONE,
            },
            "end": {
                "dateTime": timezone.localtime(ends_at).isoformat(),
                "timeZone": settings.TIME_ZONE,
            },
            "conferenceData": {
                "createRequest": {
                    "requestId": request_id,
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }
        if attendees:
            event_body["attendees"] = attendees

        event = service.events().insert(
            calendarId=config.calendar_id or "primary",
            body=event_body,
            conferenceDataVersion=1,
            sendUpdates="all" if attendees else "none",
        ).execute()

        meet_link = event.get("hangoutLink")
        event_id = event.get("id")
        if not event_id or not meet_link:
            logger.error("Google Calendar event created without Meet link: %s", event)
            raise ValueError("Google Calendar did not return a Meet link.")

        return MeetEventResult(
            event_id=event_id,
            meet_link=meet_link,
            attendee_emails=attendee_emails,
        )


calendar_service = GoogleCalendarService()
