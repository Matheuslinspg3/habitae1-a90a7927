import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Heart, Settings, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useConsumerFavorites } from "@/hooks/useConsumerFavorites";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email?: string; name?: string }>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name,
        });
      }
    });
  }, []);

  const { favorites } = useConsumerFavorites(user?.id);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/app/onboarding", { replace: true });
  };

  if (!user) return null;

  const initials = (user.name || user.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background safe-area-top">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Perfil</h1>
      </header>

      <div className="px-4 py-8">
        {/* Avatar + Info */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-xl bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="font-semibold text-lg text-foreground">{user.name || "Usuário"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mb-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{favorites.size}</p>
            <p className="text-xs text-muted-foreground">Favoritos</p>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Menu */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start h-12 text-base"
            onClick={() => navigate("/app/favoritos")}
          >
            <Heart className="mr-3 h-5 w-5" /> Imóveis salvos
          </Button>
          <Button variant="ghost" className="w-full justify-start h-12 text-base" disabled>
            <Settings className="mr-3 h-5 w-5" /> Configurações
          </Button>
          <Button variant="ghost" className="w-full justify-start h-12 text-base" disabled>
            <Moon className="mr-3 h-5 w-5" /> Tema escuro
          </Button>
        </div>

        <Separator className="my-6" />

        <Button variant="outline" className="w-full h-12 text-destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-5 w-5" /> Sair
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-8">Habitae v1.0</p>
      </div>
    </div>
  );
}
