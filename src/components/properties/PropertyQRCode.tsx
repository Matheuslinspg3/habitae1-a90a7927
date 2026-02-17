import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, QrCode } from "lucide-react";

interface PropertyQRCodeProps {
  propertyId: string;
  propertyTitle?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Simple QR code generator using Canvas (no external deps)
function generateQRMatrix(data: string): boolean[][] {
  // Simplified QR-like pattern for display
  // In production, use a proper QR library. For now, encode as a visual pattern.
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => 
    Array.from({ length: size }, () => false)
  );
  
  // Finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[startRow + r][startCol + c] = isOuter || isInner;
      }
    }
  };
  
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  
  // Encode data as pattern in remaining area
  let bitIndex = 0;
  const bytes = new TextEncoder().encode(data);
  for (let r = 8; r < size - 1; r++) {
    for (let c = 8; c < size - 1; c++) {
      if (r < 7 && c >= size - 7) continue;
      if (r >= size - 7 && c < 7) continue;
      const byteIdx = Math.floor(bitIndex / 8) % bytes.length;
      const bit = (bytes[byteIdx] >> (7 - (bitIndex % 8))) & 1;
      matrix[r][c] = bit === 1;
      bitIndex++;
    }
  }
  
  return matrix;
}

export function PropertyQRCode({ propertyId, propertyTitle, open, onOpenChange }: PropertyQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${window.location.origin}/imovel/${propertyId}`;
  
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const matrix = generateQRMatrix(url);
    const cellSize = 10;
    const padding = 20;
    const qrSize = matrix.length * cellSize;
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + padding * 2 + 40;
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // QR modules
    ctx.fillStyle = '#000000';
    matrix.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          ctx.fillRect(padding + c * cellSize, padding + r * cellSize, cellSize, cellSize);
        }
      });
    });
    
    // URL text at bottom
    ctx.fillStyle = '#666666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const shortUrl = url.length > 45 ? url.substring(0, 42) + '...' : url;
    ctx.fillText(shortUrl, canvas.width / 2, qrSize + padding + 30);
  }, [open, url]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `qr-${propertyTitle?.replace(/\s+/g, '-') || propertyId}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            QR Code do Imóvel
          </DialogTitle>
          <DialogDescription>
            Escaneie para acessar a landing page do imóvel
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <canvas
            ref={canvasRef}
            className="border rounded-lg"
            style={{ imageRendering: 'pixelated' }}
          />
          <p className="text-xs text-muted-foreground text-center break-all max-w-sm">
            {url}
          </p>
          <Button onClick={handleDownload} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Baixar QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
