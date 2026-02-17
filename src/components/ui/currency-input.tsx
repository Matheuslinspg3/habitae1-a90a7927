import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, placeholder = "R$ 0,00", ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Sincroniza valor externo com display
    React.useEffect(() => {
      if (value === null || value === undefined || value === 0) {
        setDisplayValue("");
      } else {
        const formatted = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
        setDisplayValue(formatted);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Remove tudo que não é número
      const numericValue = inputValue.replace(/\D/g, "");
      
      if (!numericValue) {
        setDisplayValue("");
        onChange(null);
        return;
      }
      
      // Converte centavos para reais
      const cents = parseInt(numericValue, 10);
      const reais = cents / 100;
      
      // Formata para exibição
      const formatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(reais);
      
      setDisplayValue(formatted);
      onChange(reais);
    };

    return (
      <input
        type="text"
        inputMode="numeric"
        className={cn(
          "flex h-11 w-full rounded-lg border border-input bg-background/50 backdrop-blur-sm px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

interface PercentageInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}

const PercentageInput = React.forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ className, value, onChange, placeholder = "0,00%", ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Sincroniza valor externo com display
    React.useEffect(() => {
      if (value === null || value === undefined) {
        setDisplayValue("");
      } else {
        setDisplayValue(`${value.toFixed(2).replace(".", ",")}%`);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Remove tudo que não é número
      const numericValue = inputValue.replace(/\D/g, "");
      
      if (!numericValue) {
        setDisplayValue("");
        onChange(null);
        return;
      }
      
      // Converte para decimal (ex: 600 -> 6.00%)
      const percentage = parseInt(numericValue, 10) / 100;
      
      // Formata para exibição
      setDisplayValue(`${percentage.toFixed(2).replace(".", ",")}%`);
      onChange(percentage);
    };

    return (
      <input
        type="text"
        inputMode="numeric"
        className={cn(
          "flex h-11 w-full rounded-lg border border-input bg-background/50 backdrop-blur-sm px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        {...props}
      />
    );
  }
);
PercentageInput.displayName = "PercentageInput";

export { CurrencyInput, PercentageInput };
