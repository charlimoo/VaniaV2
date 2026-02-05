# backend/services/tool_ui_schemas.py
from typing import List, Dict, Any, Optional, Union, Literal
from pydantic import BaseModel, Field

# --- Shared Schemas ---

class Action(BaseModel):
    id: str
    label: str
    confirm_label: Optional[str] = Field(None, alias="confirmLabel")
    variant: Optional[Literal["default", "destructive", "secondary", "ghost", "outline"]] = None
    loading: Optional[bool] = None
    disabled: Optional[bool] = None
    shortcut: Optional[str] = None

    class Config:
        populate_by_name = True

class ActionsConfig(BaseModel):
    items: List[Action]
    align: Optional[Literal["left", "center", "right"]] = None
    confirm_timeout: Optional[int] = Field(None, alias="confirmTimeout")

    class Config:
        populate_by_name = True

FooterActions = Union[List[Action], ActionsConfig]

# --- Chart Schemas ---

class ChartSeries(BaseModel):
    key: str
    label: str
    color: Optional[str] = None

class ChartSchema(BaseModel):
    surface_id: str = Field(..., alias="surfaceId")
    type: Literal["bar", "line", "pie"]
    title: Optional[str] = None
    description: Optional[str] = None
    data: List[Dict[str, Any]]
    x_key: str = Field(..., alias="xKey")
    series: List[ChartSeries]
    colors: Optional[List[str]] = None
    show_legend: Optional[bool] = Field(False, alias="showLegend")
    show_grid: Optional[bool] = Field(True, alias="showGrid")

    class Config:
        populate_by_name = True

# --- DataTable Schemas ---

class FormatConfig(BaseModel):
    kind: str

class TextFormat(FormatConfig):
    kind: Literal["text"] = "text"

class NumberFormat(FormatConfig):
    kind: Literal["number"] = "number"
    decimals: Optional[int] = None
    unit: Optional[str] = None
    compact: Optional[bool] = None
    show_sign: Optional[bool] = Field(None, alias="showSign")

    class Config:
        populate_by_name = True

class CurrencyFormat(FormatConfig):
    kind: Literal["currency"] = "currency"
    currency: str
    decimals: Optional[int] = None

class PercentFormat(FormatConfig):
    kind: Literal["percent"] = "percent"
    decimals: Optional[int] = None
    show_sign: Optional[bool] = Field(None, alias="showSign")
    basis: Optional[Literal["fraction", "unit"]] = None

    class Config:
        populate_by_name = True

class DateFormat(FormatConfig):
    kind: Literal["date"] = "date"
    date_format: Optional[Literal["short", "long", "relative"]] = Field(None, alias="dateFormat")

    class Config:
        populate_by_name = True

class DeltaFormat(FormatConfig):
    kind: Literal["delta"] = "delta"
    decimals: Optional[int] = None
    up_is_positive: Optional[bool] = Field(None, alias="upIsPositive")
    show_sign: Optional[bool] = Field(None, alias="showSign")

    class Config:
        populate_by_name = True

class StatusTone(BaseModel):
    tone: Literal["success", "warning", "danger", "info", "neutral"]
    label: Optional[str] = None

class StatusFormat(FormatConfig):
    kind: Literal["status"] = "status"
    status_map: Dict[str, StatusTone] = Field(..., alias="statusMap")

    class Config:
        populate_by_name = True

class BooleanFormat(FormatConfig):
    kind: Literal["boolean"] = "boolean"
    labels: Optional[Dict[str, str]] = None  # Keys "true", "false"

class LinkFormat(FormatConfig):
    kind: Literal["link"] = "link"
    href_key: Optional[str] = Field(None, alias="hrefKey")
    external: Optional[bool] = None

    class Config:
        populate_by_name = True

class BadgeFormat(FormatConfig):
    kind: Literal["badge"] = "badge"
    color_map: Optional[Dict[str, Literal["success", "warning", "danger", "info", "neutral"]]] = Field(None, alias="colorMap")

    class Config:
        populate_by_name = True

class ArrayFormat(FormatConfig):
    kind: Literal["array"] = "array"
    max_visible: Optional[int] = Field(None, alias="maxVisible")

    class Config:
        populate_by_name = True

# Union of all format types for use in Column
AnyFormat = Union[
    TextFormat, NumberFormat, CurrencyFormat, PercentFormat, DateFormat,
    DeltaFormat, StatusFormat, BooleanFormat, LinkFormat, BadgeFormat, ArrayFormat
]

class Column(BaseModel):
    key: str
    label: str
    abbr: Optional[str] = None
    sortable: Optional[bool] = None
    align: Optional[Literal["left", "right", "center"]] = None
    width: Optional[str] = None
    truncate: Optional[bool] = None
    priority: Optional[Literal["primary", "secondary", "tertiary"]] = None
    hide_on_mobile: Optional[bool] = Field(None, alias="hideOnMobile")
    format: Optional[AnyFormat] = None

    class Config:
        populate_by_name = True

class DataTableSchema(BaseModel):
    surface_id: str = Field(..., alias="surfaceId")
    columns: List[Column]
    data: List[Dict[str, Any]]
    layout: Optional[Literal["auto", "table", "cards"]] = None
    row_id_key: Optional[str] = Field(None, alias="rowIdKey")
    empty_message: Optional[str] = Field(None, alias="emptyMessage")
    footer_actions: Optional[FooterActions] = Field(None, alias="footerActions")

    class Config:
        populate_by_name = True

# --- OptionList Schemas ---

class OptionListOption(BaseModel):
    id: str
    label: str
    description: Optional[str] = None
    disabled: Optional[bool] = None

class OptionListSchema(BaseModel):
    surface_id: str = Field(..., alias="surfaceId")
    options: List[OptionListOption]
    selection_mode: Optional[Literal["multi", "single"]] = Field(None, alias="selectionMode")
    value: Optional[Union[str, List[str]]] = None
    default_value: Optional[Union[str, List[str]]] = Field(None, alias="defaultValue")
    confirmed: Optional[Union[str, List[str]]] = None
    min_selections: Optional[int] = Field(None, alias="minSelections")
    max_selections: Optional[int] = Field(None, alias="maxSelections")
    footer_actions: Optional[FooterActions] = Field(None, alias="footerActions")

    class Config:
        populate_by_name = True

# --- MediaCard Schemas ---

class MediaSource(BaseModel):
    label: str
    icon_url: Optional[str] = Field(None, alias="iconUrl")
    url: Optional[str] = None

    class Config:
        populate_by_name = True

class OpenGraph(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, alias="imageUrl")

    class Config:
        populate_by_name = True

class MediaCardSchema(BaseModel):
    surface_id: str = Field(..., alias="surfaceId")
    asset_id: str = Field(..., alias="assetId")
    kind: Literal["image", "video", "audio", "link"]
    title: Optional[str] = None
    description: Optional[str] = None
    created_at_iso: Optional[str] = Field(None, alias="createdAtISO")
    locale: Optional[str] = None
    href: Optional[str] = None
    domain: Optional[str] = None
    source: Optional[MediaSource] = None
    ratio: Optional[Literal["auto", "1:1", "4:3", "16:9", "9:16"]] = None
    fit: Optional[Literal["cover", "contain"]] = None
    src: Optional[str] = None
    thumb: Optional[str] = None
    alt: Optional[str] = None
    duration_ms: Optional[int] = Field(None, alias="durationMs")
    file_size_bytes: Optional[int] = Field(None, alias="fileSizeBytes")
    og: Optional[OpenGraph] = None
    footer_actions: Optional[FooterActions] = Field(None, alias="footerActions")

    class Config:
        populate_by_name = True

# --- Product Carousel Schemas (Custom) ---

class ProductItem(BaseModel):
    id: str
    name: str
    price: str
    description: str
    image: str

class ProductCarouselSchema(BaseModel):
    surface_id: str = Field(..., alias="surfaceId")
    items: List[ProductItem]
    
    class Config:
        populate_by_name = True