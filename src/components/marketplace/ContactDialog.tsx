import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Phone, User, Mail, Copy, Check, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MarketplaceProperty } from "@/hooks/useMarketplace";

interface ContactDialogProps {
  property: MarketplaceProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDialog({ property, open, onOpenChange }: ContactDialogProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [contactData, setContactData] = useState<any>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  useEffect(() => {
    if (open && property) {
      setLoadingContact(true);
      supabase.rpc("get_marketplace_contact", { p_property_id: property.id } as any)
        .then(({ data, error }) => {
          if (!error) setContactData(data);
          setLoadingContact(false);
        });
    }
  }, [open, property]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "Copiado!", description: `${field} copiado para a área de transferência.` });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(
      `Olá! Vi o imóvel "${property?.title}" no Marketplace Habitae e gostaria de mais informações.`
    );
    window.open(`https://wa.me/${fullPhone}?text=${message}`, "_blank");
  };

  if (!property) return null;

  const name = contactData?.owner_name || contactData?.org_name;
  const phone = contactData?.owner_phone || contactData?.org_phone;
  const email = contactData?.org_email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contato do Corretor</DialogTitle>
          <DialogDescription>{property.title}</DialogDescription>
        </DialogHeader>
        {loadingContact ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {name && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{name}</span>
                    {contactData?.org_name && contactData?.owner_name && contactData.org_name !== contactData.owner_name && (
                      <p className="text-xs text-muted-foreground">{contactData.org_name}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {phone && (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{phone}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(phone, "Telefone")}
                  >
                    {copiedField === "Telefone" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  className="w-full gap-2"
                  variant="default"
                  onClick={() => openWhatsApp(phone)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversar no WhatsApp
                </Button>
              </>
            )}
            {email && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyToClipboard(email, "Email")}
                >
                  {copiedField === "Email" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            {!name && !phone && !email && (
              <p className="text-muted-foreground text-center py-4">
                Dados de contato não disponíveis para este imóvel.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
