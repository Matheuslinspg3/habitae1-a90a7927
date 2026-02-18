import { Bell, CheckCheck, Home, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";


const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  new_property: Home,
  contract: FileText,
};

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const Icon = iconMap[notification.type] || Bell;

  const handleClick = () => {
    if (!notification.read) onRead(notification.id);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-3 rounded-lg transition-colors hover:bg-muted/80 ${
        !notification.read ? "bg-primary/5 border-l-2 border-primary" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-full shrink-0 ${!notification.read ? "bg-primary/10" : "bg-muted"}`}>
          <Icon className={`h-3.5 w-3.5 ${!notification.read ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${!notification.read ? "font-medium" : ""}`}>{notification.title}</p>
          {notification.message && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => markAllAsRead()}>
              <CheckCheck className="h-3 w-3" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="p-1 space-y-0.5">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
