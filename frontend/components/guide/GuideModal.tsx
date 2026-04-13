"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type GuideAssistant = {
  name: string;
  description: string;
  useCases?: string[];
  note?: string;
};

const guideAssistants: GuideAssistant[] = [
  {
    name: "روانیار",
    description: "برای گفتگو درباره احساسات، روابط، نگرانی‌ها و مسائل روانشناختی روزمره.",
    useCases: ["مدیریت استرس و اضطراب", "بهبود روابط", "درک بهتر احساسات", "تصمیم‌گیری در مسائل شخصی"],
    note: "روانیار جایگزین درمانگر نیست، اما می‌تواند شما را برای مراجعه به متخصص آماده کند.",
  },
  {
    name: "فال قهوه و تفسیر روانشناختی",
    description:
      "یک فضای تجربه‌ای و الهام‌بخش که از نمادهای فال قهوه برای ارائه پیام‌های انگیزشی و تأمل‌برانگیز استفاده می‌کند.",
    useCases: ["سرگرمی", "نمادشناسی", "تفسیر روانشناختی"],
  },
  {
    name: "همیار مراجع",
    description: "این دستیار به شما کمک می‌کند قبل از مراجعه به متخصص مسئله خود را بهتر تنظیم و توضیح دهید.",
    useCases: ["آماده‌سازی برای جلسه", "جمع‌آوری اطلاعات اولیه", "ثبت توضیحات مسئله", "پیشنهاد متخصص مناسب"],
  },
  {
    name: "همیار تحصیلی",
    description: "مناسب برای دانش‌آموزان و دانشجویان.",
    useCases: ["برنامه‌ریزی درسی", "مدیریت زمان", "روش‌های مطالعه مؤثر", "آمادگی برای امتحان"],
  },
  {
    name: "همیار چالش مطالعه‌ای",
    description: "برای افرادی که در شروع مطالعه، تمرکز یا تداوم برنامه مشکل دارند.",
    useCases: ["چالش‌های مطالعه", "پیگیری پیشرفت", "افزایش تمرکز", "کاهش اهمال‌کاری"],
  },
  {
    name: "همیار شغلی",
    description: "برای مدیریت مسیر شغلی و چالش‌های محیط کار.",
    useCases: ["انتخاب شغل", "تغییر مسیر حرفه‌ای", "مدیریت تعارض در محیط کار", "برنامه‌ریزی شغلی", "رزومه‌نویسی"],
  },
  {
    name: "همیار عدالت",
    description: "برای آگاهی اولیه درباره مسائل حقوقی.",
    useCases: ["تحلیل ساده قراردادها", "آشنایی با حقوق قانونی", "آماده‌سازی برای مراجعه به وکیل", "جمع‌آوری اطلاعات پرونده"],
    note: "این دستیار جایگزین مشاوره حقوقی تخصصی نیست.",
  },
];

const guidePlatformSections = [
  { title: "پیشخوان", description: "نمای کلی فعالیت‌ها، پیام‌ها و پیشنهادهای دستیار." },
  { title: "گفتگو", description: "محل اصلی ارتباط با دستیارهای هوشمند." },
  { title: "مسیر من", description: "تمام تحلیل‌ها، توصیه‌ها و مراحل پیگیری در این بخش ثبت می‌شود." },
  { title: "متخصصان من", description: "نمایش متخصصانی که با آن‌ها در ارتباط هستید و امکان درخواست جلسه." },
  { title: "جلسات", description: "مدیریت نوبت‌ها و جلسات." },
  { title: "بارگذاری مدارک", description: "امکان ارسال فایل‌ها، تصاویر، اسناد و آزمایش‌ها برای تحلیل بهتر." },
  { title: "سفارشات", description: "سوابق پرداخت و اشتراک‌ها." },
  { title: "تنظیمات", description: "مدیریت اطلاعات حساب کاربری." },
];

const guideSpecialists = [
  { role: "روانشناسان", description: "متخصصان می‌توانند از دستیار هوشمند برای مصاحبه اولیه، تحلیل تست‌ها، طراحی طرح درمان و مدیریت جلسات استفاده کنند." },
  { role: "روانپزشکان", description: "امکان بررسی اطلاعات بیمار، تحلیل داده‌های پرونده و کمک در طراحی مسیر درمان." },
  { role: "پزشکان", description: "کمک در تحلیل علائم، بررسی مدارک پزشکی و پیشنهاد مسیر تشخیصی." },
  { role: "وکلا و حقوقدانان", description: "تحلیل اسناد و پرونده‌ها، استخراج نکات کلیدی و کمک در تنظیم متون حقوقی." },
];

const shortGuideAssistants = [
  { name: "روانیار", description: "برای گفتگو درباره احساسات، روابط و مسائل روانشناختی." },
  { name: "فال قهوه", description: "برای دریافت تفسیر نمادین و پیام‌های الهام‌بخش." },
  { name: "همیار مراجع", description: "برای آماده شدن قبل از مراجعه به متخصص." },
  { name: "همیار تحصیلی", description: "برای برنامه‌ریزی و مدیریت درس و امتحان." },
  { name: "همیار چالش مطالعه‌ای", description: "برای ایجاد عادت مطالعه و افزایش تمرکز." },
  { name: "همیار شغلی", description: "برای تصمیم‌های شغلی و مدیریت مسیر حرفه‌ای." },
  { name: "همیار عدالت", description: "برای آگاهی اولیه درباره مسائل حقوقی." },
];

const shortGuideSections = [
  { title: "پیشخوان", description: "نمای کلی فعالیت‌ها و پیام‌ها." },
  { title: "گفتگو", description: "محل طرح سوال و دریافت پاسخ از دستیار." },
  { title: "مسیر من", description: "پیگیری تحلیل‌ها و توصیه‌ها." },
  { title: "متخصصان من", description: "ارتباط با متخصصان و درخواست جلسه." },
  { title: "جلسات", description: "مدیریت زمان جلسات." },
  { title: "بارگذاری مدارک", description: "ارسال فایل‌ها و اسناد برای تحلیل." },
  { title: "سفارشات", description: "مدیریت اشتراک و پرداخت‌ها." },
  { title: "تنظیمات", description: "مدیریت اطلاعات حساب کاربری." },
];

type GuideModalProps = {
  triggerLabel?: string;
  triggerMode?: "button" | "text";
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  triggerClassName?: string;
};

export function GuideModal({
  triggerLabel = "مشاهده راهنمای کامل",
  triggerMode = "button",
  buttonVariant = "outline",
  triggerClassName,
}: GuideModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {triggerMode === "text" ? (
          <button
            type="button"
            className={cn("hover:text-zinc-300 transition-colors", triggerClassName)}
          >
            {triggerLabel}
          </button>
        ) : (
          <Button variant={buttonVariant} className={triggerClassName}>
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-xl">راهنمای مرکز راهنمای وانیا آپ</DialogTitle>
          <DialogDescription>مروری سریع و کاربردی برای استفاده بهتر از پلتفرم.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm leading-7 text-foreground/90">
          <section className="rounded-lg border border-border/60 p-4 bg-muted/20">
            <h3 className="font-semibold text-base mb-2">آشنایی با وانیا آپ</h3>
            <p>
              وانیا آپ یک پلتفرم دستیار هوشمند (IA) است که با ترکیب هوش مصنوعی و همکاری متخصصان به کاربران کمک می‌کند
              مسائل شخصی، روانشناختی، تحصیلی، شغلی، پزشکی و حقوقی خود را بهتر مدیریت کنند.
            </p>
            <p className="mt-2">
              کاربران می‌توانند با دستیارهای مختلف گفتگو کنند، مدارک خود را بارگذاری کنند و در صورت نیاز با متخصصان
              مرتبط ارتباط برقرار نمایند.
            </p>
            <p className="mt-2 font-medium text-primary">شعار پلتفرم: وانیا آپ، همراه هوشمند شما</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-3">بخش کاربران عمومی</h3>
            <p className="text-muted-foreground mb-3">
              کاربران عمومی در وانیا آپ به ۷ دستیار هوشمند دسترسی دارند که هر کدام برای یک حوزه طراحی شده‌اند.
            </p>
            <div className="grid gap-3">
              {guideAssistants.map((assistant) => (
                <article key={assistant.name} className="rounded-lg border border-border/50 p-3 bg-background/60">
                  <h4 className="font-semibold">{assistant.name}</h4>
                  <p className="text-muted-foreground mt-1">{assistant.description}</p>
                  {!!assistant.useCases?.length && (
                    <ul className="mt-2 list-disc pr-5 space-y-1 text-xs text-foreground/90">
                      {assistant.useCases.map((useCase) => (
                        <li key={useCase}>{useCase}</li>
                      ))}
                    </ul>
                  )}
                  {assistant.note && <p className="mt-2 text-xs text-primary">{assistant.note}</p>}
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-3">بخش‌های اصلی پلتفرم برای کاربران</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {guidePlatformSections.map((section) => (
                <div key={section.title} className="rounded-lg border border-border/50 p-3">
                  <p className="font-medium">{section.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-3">بخش متخصصان</h3>
            <div className="grid gap-2">
              {guideSpecialists.map((specialist) => (
                <div key={specialist.role} className="rounded-lg border border-border/50 p-3">
                  <p className="font-medium">{specialist.role}</p>
                  <p className="text-xs text-muted-foreground mt-1">{specialist.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h3 className="font-semibold text-base mb-2">راهنمای کوتاه (Onboarding داخل هر بخش)</h3>
            <p className="font-medium">پیام خوش‌آمد</p>
            <p className="mt-1">
              به وانیا آپ خوش آمدید. وانیا آپ دستیار هوشمند شما برای مدیریت مسائل زندگی، تحصیل، شغل، سلامت و حقوق است.
            </p>
            <ul className="mt-2 list-disc pr-5 space-y-1">
              <li>با یک دستیار گفتگو کنید.</li>
              <li>مدارک خود را بارگذاری کنید.</li>
              <li>یا با یک متخصص ارتباط بگیرید.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-3">راهنمای دستیارها</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {shortGuideAssistants.map((assistant) => (
                <div key={assistant.name} className="rounded-lg border border-border/50 p-3">
                  <p className="font-medium">{assistant.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{assistant.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-3">راهنمای بخش‌های پلتفرم</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {shortGuideSections.map((section) => (
                <div key={section.title} className="rounded-lg border border-border/50 p-3">
                  <p className="font-medium">{section.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
