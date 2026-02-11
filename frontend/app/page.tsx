// frontend/app/page.tsx
"use client";

import React from "react";
import { Bot } from "lucide-react";
import Silk from "@/components/react-bits/Silk";
import BlurText from "@/components/react-bits/BlurText";
import { AuthContainer } from "@/components/auth/auth-container";
import { APP_CONFIG } from "@/lib/config";

export default function LandingPage() {
  return (
    <main 
      dir="rtl" 
      className="relative h-dvh w-full overflow-hidden bg-[#030303] text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-white"
    >
      
      {/* --- BACKGROUND LAYER --- */}
      <div className="absolute inset-0 z-0 opacity-100 pointer-events-none">
        <Silk
          speed={10}             // Slower, more majestic movement
          scale={0.8}
          color="#1a1a1a"       // Very dark charcoal, almost black
          noiseIntensity={0.1}  // Minimal grain
          rotation={0}
        />
        {/* Vignette Overlay for focus */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#030303_100%)]" />
      </div>

      {/* --- MAIN GRID CONTENT --- */}
      <div className="relative z-10 grid h-full w-full grid-cols-1 lg:grid-cols-2 container mx-auto px-6">
        
        {/* RIGHT COLUMN (RTL START): Brand & Copy */}
        <div className="flex flex-col justify-center items-start h-full space-y-8 lg:pr-12 order-2 lg:order-1 pt-10 lg:pt-0 pb-10">
          
          {/* Logo */}
          <div className="flex items-center gap-3 mb-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
                {APP_CONFIG.IMAGES.LOGO_ICON ? (
                  <img src={APP_CONFIG.IMAGES.LOGO_ICON} alt="Logo" className="h-6 w-6 object-contain" />
                ) : (
                  <Bot className="h-6 w-6 text-zinc-300" />
                )}
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-200">
              {APP_CONFIG.BRANDING.COMPANY_NAME}
            </span>
          </div>

          {/* Hero Text */}
          <div className="space-y-4">
            <div className="text-4xl lg:text-6xl font-black text-white leading-tight tracking-tighter">
                <BlurText
                  text="وانـــــیا"
                  delay={150}
                  animateBy="words"
                  direction="top"
                  className="block text-zinc-500 mb-2"
                />
                <BlurText
                  text="همراه هوشمند شما"
                  delay={300}
                  animateBy="words"
                  direction="bottom"
                  className="block text-white"
                />
            </div>
            
            <p className="text-zinc-400 text-sm lg:text-base max-w-md leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
برای روان شناسان و روان پزشکان و مراجعین آنها
            </p>
          </div>

          {/* Trust Badge / Footer Note */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-600 animate-in fade-in duration-1000 delay-700">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ثبت نام رایگان</span>
          </div>
        </div>

        {/* LEFT COLUMN (RTL END): Auth Container */}
        <div className="flex flex-col justify-center items-center h-full order-1 lg:order-2">
          <AuthContainer />
        </div>

      </div>
    </main>
  );
}