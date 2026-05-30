"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon, User, MapPin, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { fetchAllLocationOptions, parseLocationName, sortLocationsForPicker } from "@/lib/location-utils";
import { cn, fixAvatarUrl } from "@/lib/utils";

interface ProfileFormData {
  bio: string;
  clinic_address: string;
  location_id: string;
  specialty: string;
  is_public: boolean;
  accepting_new_patients: boolean;
  meeting_price: number;
}

interface Location {
  id: number;
  name: string;
}

interface DoctorProfileModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const EN_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function tripletToPersianWords(num: number): string {
  if (num === 0) return "";

  const parts: string[] = [];
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundred > 0) parts.push(HUNDREDS[hundred]);

  if (remainder >= 10 && remainder <= 19) {
    parts.push(TEENS[remainder - 10]);
  } else {
    const ten = Math.floor(remainder / 10);
    const one = remainder % 10;
    if (ten > 0) parts.push(TENS[ten]);
    if (one > 0) parts.push(ONES[one]);
  }

  return parts.join(" و ");
}

function numberToPersianWords(num: number): string {
  if (num === 0) return "صفر";

  const scales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];
  const parts: string[] = [];
  let remaining = num;
  let scaleIndex = 0;

  while (remaining > 0 && scaleIndex < scales.length) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const words = tripletToPersianWords(chunk);
      const scale = scales[scaleIndex];
      parts.unshift(scale ? `${words} ${scale}` : words);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  return parts.join(" و ");
}

function parseMeetingPriceValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function formatMeetingPriceInput(value: number | string | null | undefined): string {
  const parsed = parseMeetingPriceValue(value);
  if (parsed === null) return "";
  return EN_NUMBER_FORMATTER.format(parsed);
}

function getMeetingPriceDisplay(value: number | string | null | undefined): { words: string } | null {
  const rounded = parseMeetingPriceValue(value);
  if (rounded === null) return null;
  return {
    words: `${numberToPersianWords(rounded)} تومان`,
  };
}

function hasProfileSentence(value: string | null | undefined): boolean {
  const text = (value || "").trim().replace(/\s+/g, " ");
  return text.length >= 10 && text.split(" ").length >= 2;
}

function extractProfileError(payload: any): string {
  const publicProfileError = payload?.is_public;
  if (Array.isArray(publicProfileError)) return publicProfileError.join(" ");
  if (typeof publicProfileError === "string") return publicProfileError;
  return "خطا در بروزرسانی پروفایل.";
}

export function DoctorProfileModal({ isOpen, onOpenChange, onUpdate }: DoctorProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<ProfileFormData>();
  
  // Image State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setPreviewUrl(null);
      setSelectedFile(null);
      
      // Fetch Locations and Profile in parallel
      Promise.all([
        fetchAllLocationOptions<Location>(`${API_BASE_URL}/api/vania/locations/`, getAuthHeaders()),
        fetch(`${API_BASE_URL}/api/vania/my-profile/`, { headers: getAuthHeaders() }).then(r => r.json())
      ])
      .then(([locData, profileData]) => {
        setLocations(locData);

        // Ensure location_id is a string for the Select component
        const formattedData = {
            ...profileData,
            location_id: profileData.location_id ? String(profileData.location_id) : "" 
        };
        reset(formattedData);
        // [FIX] Apply URL fix here
        if (profileData.avatar) {
          setPreviewUrl(fixAvatarUrl(profileData.avatar));
        }
        setLoading(false);
      })
      .catch((err) => {
          console.error(err);
          toast.error("خطا در دریافت اطلاعات");
          setLocations([]);
          setLoading(false);
      });
    }
  }, [isOpen, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        toast.error("حجم تصویر نباید بیشتر از ۲ مگابایت باشد.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("bio", data.bio || "");
      formData.append("clinic_address", data.clinic_address || "");
      if (data.location_id) {
          formData.append("location_id", data.location_id);
      }
      formData.append("specialty", data.specialty || "");
      formData.append("meeting_price", String(data.meeting_price || 0));
      
      formData.append("is_public", data.is_public ? "True" : "False");
      formData.append("accepting_new_patients", data.accepting_new_patients ? "True" : "False");

      if (selectedFile) {
        formData.append("avatar", selectedFile);
      }

      const headers = getAuthHeaders();
      delete headers["Content-Type"]; // Important for FormData

      const res = await fetch(`${API_BASE_URL}/api/vania/my-profile/`, {
        method: "PATCH",
        headers: headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        console.error("Upload Error:", errData);
        throw new Error(extractProfileError(errData));
      }
      
      toast.success("پروفایل شما با موفقیت بروزرسانی شد.");
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "خطا در بروزرسانی پروفایل.");
    } finally {
      setSubmitting(false);
    }
  };
  
  const isPublic = watch("is_public");
  const meetingPriceDisplay = getMeetingPriceDisplay(watch("meeting_price"));
  const sortedLocations = sortLocationsForPicker(locations);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[78vh] overflow-y-auto">
        <DialogHeader className="text-right">
          <DialogTitle>ویرایش پروفایل عمومی</DialogTitle>
          <DialogDescription>
             اطلاعات مطب و تخصص خود را ویرایش کنید.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 py-4">
            
            {/* Image Uploader */}
            <div className="flex flex-col items-center gap-3">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Avatar className="h-24 w-24 border-2 border-border shadow-md transition-opacity group-hover:opacity-80">
                        <AvatarImage src={previewUrl || ""} className="object-cover" />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                            <User className="h-10 w-10" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full">
                        <Upload className="h-6 w-6 text-white drop-shadow-md" />
                    </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="h-3.5 w-3.5 ml-1.5" />
                    تغییر تصویر پروفایل
                </Button>
                <p className="max-w-xs text-center text-[11px] leading-5 text-muted-foreground">
                  برای اعتماد و جذب بهتر مخاطب، پیشنهاد می‌کنیم تصویر واضحی از خودتان اضافه کنید.
                </p>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleFileChange}
                />
            </div>

            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="specialty">تخصص اصلی</Label>
                    <Input
                      id="specialty"
                      {...register("specialty", {
                        validate: (value) => !isPublic || Boolean(value?.trim()) || "برای نمایش در لیست متخصصین، تخصص اصلی را وارد کنید.",
                      })}
                      placeholder="مثلا: روانشناس بالینی"
                      aria-invalid={Boolean(errors.specialty)}
                    />
                    {errors.specialty?.message && (
                      <p className="text-[11px] text-destructive">{errors.specialty.message}</p>
                    )}
                </div>

                {/* Location Selection */}
                <div className="grid gap-2">
                    <Label>استان یا شهر محل فعالیت</Label>
                    <Controller
                        control={control}
                        name="location_id"
                        rules={{
                          validate: (value) => !isPublic || Boolean(value) || "برای نمایش در لیست متخصصین، استان یا شهر را انتخاب کنید.",
                        }}
                        render={({ field }) => (
                            <Popover open={locationPickerOpen} onOpenChange={setLocationPickerOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={locationPickerOpen}
                                  className="w-full justify-between font-normal"
                                >
                                  <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate">
                                      {(() => {
                                        const selectedLocation = locations.find((loc) => String(loc.id) === field.value);
                                        return selectedLocation
                                          ? parseLocationName(selectedLocation.name).label
                                          : "استان یا شهر را انتخاب کنید";
                                      })()}
                                    </span>
                                  </span>
                                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[calc(100vw-1rem)] max-w-[min(32rem,var(--radix-popover-available-width))] p-0 sm:w-[min(32rem,calc(100vw-2rem))]"
                                align="end"
                                dir="rtl"
                                collisionPadding={8}
                                sideOffset={6}
                                onWheelCapture={(event) => event.stopPropagation()}
                              >
                                <Command className="text-right">
                                  <CommandInput className="text-right" placeholder="جستجوی استان یا شهر..." />
                                  <CommandList className="max-h-none overflow-visible">
                                    <CommandEmpty>موردی پیدا نشد.</CommandEmpty>
                                    <ScrollArea className="h-[min(24rem,70vh)]" onWheelCapture={(event) => event.stopPropagation()}>
                                      <CommandGroup>
                                        {sortedLocations.map((loc) => {
                                          const parsedLocation = parseLocationName(loc.name);

                                          return (
                                            <CommandItem
                                              key={loc.id}
                                              value={parsedLocation.searchValue}
                                              onSelect={() => {
                                                field.onChange(String(loc.id));
                                                setLocationPickerOpen(false);
                                              }}
                                              className="flex-row-reverse text-right"
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  String(loc.id) === field.value ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              <div className="flex min-w-0 flex-1 flex-row-reverse items-center justify-between gap-3 text-right">
                                                <span className="truncate text-right">{parsedLocation.label}</span>
                                                {!parsedLocation.isProvince && (
                                                  <span className="shrink-0 text-[11px] text-muted-foreground">
                                                    شهر
                                                  </span>
                                                )}
                                              </div>
                                            </CommandItem>
                                          );
                                        })}
                                      </CommandGroup>
                                    </ScrollArea>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                        )}
                    />
                    {errors.location_id?.message && (
                      <p className="text-[11px] text-destructive">{errors.location_id.message}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      برای دیده شدن بهتر در جستجوی عمومی، شهر دقیق یا در صورت نیاز نام استان را انتخاب کنید.
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="clinic_address">آدرس دقیق مطب</Label>
                    <Input
                      id="clinic_address"
                      {...register("clinic_address", {
                        validate: (value) => !isPublic || Boolean(value?.trim()) || "برای نمایش در لیست متخصصین، آدرس دقیق مطب را وارد کنید.",
                      })}
                      placeholder="خیابان..."
                      aria-invalid={Boolean(errors.clinic_address)}
                    />
                    {errors.clinic_address?.message && (
                      <p className="text-[11px] text-destructive">{errors.clinic_address.message}</p>
                    )}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="bio">درباره من (بیوگرافی)</Label>
                    <Textarea
                      id="bio"
                      {...register("bio", {
                        validate: (value) => !isPublic || hasProfileSentence(value) || "برای نمایش در لیست متخصصین، حداقل یک جمله درباره خودتان بنویسید.",
                      })}
                      placeholder="سوابق تحصیلی، حوزه فعالیت و..."
                      className="min-h-[100px]"
                      aria-invalid={Boolean(errors.bio)}
                    />
                    {errors.bio?.message && (
                      <p className="text-[11px] text-destructive">{errors.bio.message}</p>
                    )}
                </div>
                
                <div className="grid gap-2">
                    <Label htmlFor="meeting_price">هزینه جلسه (تومان)</Label>
                    <Controller
                        control={control}
                        name="meeting_price"
                        render={({ field }) => (
                            <Input
                                id="meeting_price"
                                type="text"
                                inputMode="numeric"
                                dir="ltr"
                                className="text-left"
                                value={formatMeetingPriceInput(field.value)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                onChange={(e) => {
                                    const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                                    field.onChange(digitsOnly ? Number(digitsOnly) : undefined);
                                }}
                            />
                        )}
                    />
                    {meetingPriceDisplay && (
                      <div className="space-y-1 text-xs">
                        <p className="text-muted-foreground">{meetingPriceDisplay.words}</p>
                      </div>
                    )}
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="space-y-0.5">
                        <Label htmlFor="is_public">نمایش در لیست عمومی</Label>
                        <p className="text-[10px] text-muted-foreground">اگر غیرفعال باشد، در جستجو دیده نمی‌شوید.</p>
                    </div>
                    <Switch 
                        id="is_public" 
                        checked={isPublic} 
                        onCheckedChange={(checked) => setValue("is_public", checked)} 
                    />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="space-y-0.5">
                        <Label htmlFor="accepting_new_patients">پذیرش مراجعه‌کننده جدید</Label>
                    </div>
                    <Switch 
                        id="accepting_new_patients" 
                        checked={watch("accepting_new_patients")} 
                        onCheckedChange={(checked) => setValue("accepting_new_patients", checked)} 
                    />
                </div>
            </div>
          </form>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={submitting || loading}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره تغییرات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
