"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";
import { ShoppingBag, Loader2, Check, ShoppingCart } from "lucide-react";

import { useUser } from "@/hooks/use-user";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

type Product = {
  id: string;
  name: string;
  price: string;
  description: string;
  image: string;
};

export function ProductCards({ items }: { items: Product[] }) {
  if (!items?.length) return null;

  return (
    <div className="w-full py-4" dir="rtl">
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {items.map((product) => (
            <CarouselItem key={product.id} className="pl-4 basis-3/4 sm:basis-1/2">
              <ProductCardItem product={product} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-right-3 h-8 w-8 hidden sm:flex bg-background/80 backdrop-blur" />
        <CarouselNext className="-left-3 h-8 w-8 hidden sm:flex bg-background/80 backdrop-blur" />
      </Carousel>
    </div>
  );
}

function ProductCardItem({ product }: { product: Product }) {
  const { user, loading: authLoading } = useUser();
  
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAddToCart = async () => {
    // 1. Auth Guard
    if (!user) {
      return;
    }

    // 2. Add to Cart API Call (Unified Protocol)
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/shop/cart/items/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ 
          item_type: "shop_product",
          item_id: product.id, 
          quantity: 1 
        }),
      });

      if (!res.ok) throw new Error("Failed to add to cart");

      // Optimistic update of global badge

      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (e) {
      console.error("Cart Add Error", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md h-full flex flex-col">
      <div className="relative aspect-[4/3] w-full bg-muted overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/20">
            <ShoppingBag className="h-10 w-10" />
          </div>
        )}
      </div>

      <CardContent className="flex flex-col p-3 gap-1.5 flex-grow text-start">
        <h3 className="font-semibold text-sm leading-tight line-clamp-1" title={product.name}>
          {product.name}
        </h3>
        
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5em] leading-relaxed">
          {product.description}
        </p>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-dashed border-border/50">
          <span className="font-bold text-sm tabular-nums">{product.price}</span>
          
          <Button 
            size="sm" 
            className="h-7 text-[10px] px-3 font-medium transition-all"
            onClick={handleAddToCart}
            disabled={loading || added || authLoading}
            variant={added ? "secondary" : "default"}
          >
            {authLoading || loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : added ? (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-3 w-3" />
                <span>موجود</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span>خرید</span>
                <ShoppingCart className="h-3 w-3 opacity-70" />
              </div>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}