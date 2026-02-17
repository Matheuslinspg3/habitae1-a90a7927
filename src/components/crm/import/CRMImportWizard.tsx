import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileSpreadsheet, Link2, Zap } from 'lucide-react';
import { CsvImportTab } from './tabs/CsvImportTab';
import { ImobziImportTab } from './tabs/ImobziImportTab';
import { ApiConnectTab } from './tabs/ApiConnectTab';

interface CRMImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CRMImportWizard({ open, onOpenChange }: CRMImportWizardProps) {
  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Leads</DialogTitle>
          <DialogDescription>
            Importe leads de um arquivo CSV, do Imobzi ou conecte outra plataforma
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="csv" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="csv" className="gap-1.5 text-xs sm:text-sm">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span> CSV
            </TabsTrigger>
            <TabsTrigger value="imobzi" className="gap-1.5 text-xs sm:text-sm">
              <Link2 className="h-4 w-4" />
              Imobzi
            </TabsTrigger>
            <TabsTrigger value="connect" className="gap-1.5 text-xs sm:text-sm">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Conectar</span> API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="flex-1 overflow-hidden flex flex-col mt-4">
            <CsvImportTab onClose={handleClose} />
          </TabsContent>

          <TabsContent value="imobzi" className="flex-1 overflow-hidden flex flex-col mt-4">
            <ImobziImportTab onClose={handleClose} />
          </TabsContent>

          <TabsContent value="connect" className="mt-4">
            <ApiConnectTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
