"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon, User, MapPin } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { fixAvatarUrl } from "@/lib/utils";

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

export function DoctorProfileModal({ isOpen, onOpenChange, onUpdate }: DoctorProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]); 
  const { register, handleSubmit, reset, setValue, watch, control } = useForm<ProfileFormData>();
  
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
        fetch(`${API_BASE_URL}/api/vania/locations/`, { headers: getAuthHeaders() }).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/vania/my-profile/`, { headers: getAuthHeaders() }).then(r => r.json())
      ])
      .then(([locData, profileData]) => {
        // FIX: Handle paginated response (DRF default) vs Array
        const locList = Array.isArray(locData) ? locData : (locData.results || []);
        setLocations(locList);

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
        const errData = await res.json();
        console.error("Upload Error:", errData);
        throw new Error("Failed to update profile.");
      }
      
      toast.success("پروفایل شما با موفقیت بروزرسانی شد.");
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("خطا در بروزرسانی پروفایل.");
    } finally {
      setSubmitting(false);
    }
  };
  
  const isPublic = watch("is_public");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
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
                    <Input id="specialty" {...register("specialty")} placeholder="مثلا: روانشناس بالینی" />
                </div>

                {/* Location Selection */}
                <div className="grid gap-2">
                    <Label>موقعیت مکانی (منطقه)</Label>
                    <Controller
                        control={control}
                        name="location_id"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="انتخاب منطقه..." />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    {/* Safe mapping with fallback array */}
                                    {(locations || []).map((loc) => (
                                        <SelectItem key={loc.id} value={String(loc.id)}>
                                            {loc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="clinic_address">آدرس دقیق مطب</Label>
                    <Input id="clinic_address" {...register("clinic_address")} placeholder="خیابان..." />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="bio">درباره من (بیوگرافی)</Label>
                    <Textarea id="bio" {...register("bio")} placeholder="سوابق تحصیلی، حوزه فعالیت و..." className="min-h-[100px]" />
                </div>
                
                <div className="grid gap-2">
                    <Label htmlFor="meeting_price">هزینه جلسه (تومان)</Label>
                    <Input id="meeting_price" type="number" {...register("meeting_price", { valueAsNumber: true })} />
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
                        <Label htmlFor="accepting_new_patients">پذیرش بیمار جدید</Label>
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