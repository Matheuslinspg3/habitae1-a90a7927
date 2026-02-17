import { Moon, Sun, Monitor, PartyPopper } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCallback } from 'react';
import { useCarnival } from '@/components/CarnivalThemeProvider';

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const { isCarnivalMonth, carnivalEnabled, toggleCarnival } = useCarnival();

  const handleThemeChange = useCallback((newTheme: string) => {
    document.documentElement.classList.add('dark-mode-transition');
    setTheme(newTheme);
    setTimeout(() => {
      document.documentElement.classList.remove('dark-mode-transition');
    }, 350);
  }, [setTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 ease-out-expo dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 ease-out-expo dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleThemeChange('light')}>
          <Sun className="h-4 w-4 mr-2" />
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange('dark')}>
          <Moon className="h-4 w-4 mr-2" />
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange('system')}>
          <Monitor className="h-4 w-4 mr-2" />
          Sistema
        </DropdownMenuItem>
        {isCarnivalMonth && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleCarnival}>
              <PartyPopper className="h-4 w-4 mr-2" />
              {carnivalEnabled ? 'Desligar Carnaval' : 'Ligar Carnaval'}
              {carnivalEnabled && <span className="ml-auto text-xs">✓</span>}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
