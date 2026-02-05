# backend/capabilities/core/tools.py
import uuid
import logging
import json
from typing import List, Optional, Literal, Dict, Any, Union, AsyncGenerator

from agno.tools import tool
from agno.tools.calculator import CalculatorTools

# Pydantic Schemas for UI consistency
from services.tool_ui_schemas import (
    ChartSchema, ChartSeries, Action, 
    DataTableSchema, Column, 
    MediaCardSchema, OptionListSchema, OptionListOption
)

from capabilities.registry import register_tool

logger = logging.getLogger(__name__)

# --- 1. VISUALIZATION TOOLS ---

@tool
def generate_chart(
    data: List[dict],
    x_key: str,
    series: List[ChartSeries],
    type: Literal["bar", "line", "area", "pie"] = "bar",
    title: Optional[str] = None,
    description: Optional[str] = None,
    colors: Optional[List[str]] = None,
    show_legend: bool = True,
    show_grid: bool = True,
) -> str:
    """
    Generates an interactive chart widget in the chat stream.
    Use this to visualize SQL query results or statistical data directly in the conversation.
    
    CRITICAL DATA FORMAT:
    'data' must be a list of flat dictionaries. Do not nest values.
    
    Chart Types:
    - 'bar': For categorical comparisons.
    - 'line': For trends over time.
    - 'pie': For proportional distribution.
    
    [PIE CHART INSTRUCTIONS]:
    - 'x_key' determines the segment labels (the slices).
    - The first item in 'series' determines the numeric value (size of slice).
    
    Example Data: 
    [
        {"year": "1402", "export": 100, "import": 50}, 
        {"year": "1403", "export": 120, "import": 60}
    ]
    
    Example Configuration: 
    x_key="year" 
    series=[
        {"key": "export", "label": "Exports (USD)", "color": "#10b981"},
        {"key": "import", "label": "Imports (USD)", "color": "#ef4444"}
    ]

    Args:
        data: The dataset. List of objects where keys match x_key and series keys.
        x_key: The key in 'data' objects to use for the X-axis (e.g. 'year', 'country') or Pie Slices.
        series: Configuration for the data series to plot. 
        type: Chart type. 'bar', 'line', 'area', or 'pie'.
        title: The main headline for the chart.
        description: A subtext description or summary.
        colors: Optional custom hex codes (e.g. ['#ff0000']).
        show_legend: Whether to display the legend.
        show_grid: Whether to display the grid.
    
    Returns:
        str: A JSON string strictly matching the ChartSchema for the frontend.
    """
    try:
        surface_id = f"chart-{uuid.uuid4()}"
        
        schema = ChartSchema(
            surface_id=surface_id,
            type=type,
            title=title,
            description=description,
            data=data,
            x_key=x_key,
            series=series,
            colors=colors,
            show_legend=show_legend,
            show_grid=show_grid,
        )
        return schema.model_dump_json(by_alias=True, exclude_none=True)
    except Exception as e:
        return f"Error generating chart: {str(e)}"

@tool
def show_data_table(
    data: List[dict],
    columns: List[dict],
    row_id_key: str = "id",
    title: Optional[str] = None,
    empty_message: str = "No data available.",
    footer_actions: Optional[List[Action]] = None
) -> str:
    """
    Displays a rich, interactive data table. Use this for lists, reports, or data exploration.
    
    IMPORTANT: You must define 'columns' explicitly. This allows you to control formatting.

    Args:
        data: The raw data rows. 
              Example: [{'id': '1', 'price': 10.50, 'status': 'active'}]
        
        columns: Configuration for each column.
                 Example: [{'key': 'price', 'label': 'قیمت', 'format': {'kind': 'currency', 'currency': 'USD'}}]
        
        row_id_key: The unique key in 'data' to use for row identity (e.g., 'id', 'sku').
                    REQUIRED for sorting and selection.
        
        title: A header title for the table context.
        
        empty_message: Text to show if the data array is empty.
        

    Returns:
        str: A JSON string strictly matching the DataTableSchema.
    """
    try:
        surface_id = f"table-{uuid.uuid4()}"
        
        validated_cols = [Column(**c) for c in columns]

        schema = DataTableSchema(
            surface_id=surface_id,
            columns=validated_cols,
            data=data,
            row_id_key=row_id_key,
            title=title,
            empty_message=empty_message,
            layout="auto",
            footer_actions=footer_actions
        )
        return schema.model_dump_json(by_alias=True, exclude_none=True)
    except Exception as e:
        return f"Error showing table: {str(e)}"

@tool
def show_media_card(
    kind: Literal["image", "video", "audio", "link"],
    src: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    thumb: Optional[str] = None,
    domain: Optional[str] = None,
    footer_actions: Optional[List[Action]] = None
) -> str:
    """
    Displays a rich media card for images, videos, audio clips, or external links.
    Use this tool to show previews of files, URLs, or visual content.

    Args:
        kind: The type of media content. Must be one of: 'image', 'video', 'audio', 'link'.
        
        src: The direct URL to the media asset or the link destination.
        
        title: The headline title for the card.
        
        description: A text summary or description to display below the title.
        
        thumb: URL for a thumbnail image. Highly recommended for 'video' and 'link' types.
        
        domain: The source domain name (e.g., 'youtube.com', 'docs.google.com').
                Displayed in the header for context.
        
        footer_actions: Interactive buttons to show below the media.
                        Useful for actions like 'Download', 'Open in New Tab', 'Save to Library'.
                        Example: [{'id': 'download', 'label': 'Download', 'variant': 'secondary'}]

    Returns:
        str: A JSON string strictly matching the MediaCardSchema for the frontend.
    """
    try:
        unique_id = uuid.uuid4()
        schema = MediaCardSchema(
            surface_id=f"media-{unique_id}",
            asset_id=f"asset-{unique_id}",
            kind=kind,
            src=src,
            title=title,
            description=description,
            thumb=thumb,
            domain=domain,
            href=src if kind == "link" else None,
            footer_actions=footer_actions
        )
        return schema.model_dump_json(by_alias=True, exclude_none=True)
    except Exception as e:
        return f"Error showing media: {str(e)}"

@tool
def show_option_list(
    options: List[OptionListOption],
    selection_mode: Literal["single", "multi"] = "single",
    min_selections: int = 1,
    max_selections: Optional[int] = None,
    default_value: Optional[Union[str, List[str]]] = None,
    confirmed: Optional[Union[str, List[str]]] = None,
    footer_actions: Optional[List[Action]] = None
) -> str:
    """
    Presents a list of interactive choices to the user (Radio buttons or Checkboxes).
    Use this tool for decision making, filtering, or preference selection.

    Args:
        options: The list of choices to display. 
                 Each option must have an 'id' and 'label'. Optional 'description' and 'disabled' state.
                 Example: [{'id': 'opt1', 'label': 'Option 1', 'description': 'Details'}]
        
        selection_mode: 'single' for Radio buttons (one choice), 'multi' for Checkboxes (multiple choices).
        
        min_selections: Minimum number of items that must be selected (Default: 1).
        
        max_selections: Maximum number of items allowed (Only for 'multi' mode).
        
        default_value: The ID(s) that should be pre-selected when the list first renders.
        
        confirmed: If provided, renders the list in "Receipt Mode" (Read-Only). 
                   Use this to display a decision that has ALREADY been made / finalized.
        
        footer_actions: Custom buttons to show below the list.
                        Defaults to 'Confirm' / 'Clear' if not provided.
                        Example: [{'id': 'submit', 'label': 'Submit Choices', 'variant': 'default'}]

    Returns:
        str: A JSON string strictly matching the OptionListSchema for the frontend.
    """
    try:
        schema = OptionListSchema(
            surface_id=f"options-{uuid.uuid4()}",
            options=options,
            selection_mode=selection_mode,
            min_selections=min_selections,
            max_selections=max_selections,
            default_value=default_value,
            confirmed=confirmed,
            footer_actions=footer_actions
        )
        return schema.model_dump_json(by_alias=True, exclude_none=True)
    except Exception as e:
        return f"Error showing options: {str(e)}"
