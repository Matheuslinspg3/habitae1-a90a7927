import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Undo, Redo, Type,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const AVAILABLE_VARIABLES = [
  { key: "{{nome_cliente}}", label: "Nome do Cliente" },
  { key: "{{cpf_cliente}}", label: "CPF do Cliente" },
  { key: "{{email_cliente}}", label: "E-mail do Cliente" },
  { key: "{{telefone_cliente}}", label: "Telefone do Cliente" },
  { key: "{{endereco_imovel}}", label: "Endereço do Imóvel" },
  { key: "{{codigo_imovel}}", label: "Código do Imóvel" },
  { key: "{{titulo_imovel}}", label: "Título do Imóvel" },
  { key: "{{valor_contrato}}", label: "Valor do Contrato" },
  { key: "{{tipo_contrato}}", label: "Tipo (Venda/Locação)" },
  { key: "{{data_inicio}}", label: "Data de Início" },
  { key: "{{data_fim}}", label: "Data de Fim" },
  { key: "{{corretor_nome}}", label: "Nome do Corretor" },
  { key: "{{comissao}}", label: "Comissão (%)" },
  { key: "{{dia_pagamento}}", label: "Dia de Pagamento" },
  { key: "{{indice_reajuste}}", label: "Índice de Reajuste" },
  { key: "{{data_atual}}", label: "Data Atual" },
];

export { AVAILABLE_VARIABLES };

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ content, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder || "Comece a escrever o template do contrato..." }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const insertVariable = (variable: string) => {
    editor.chain().focus().insertContent(`<span class="variable-tag" data-variable="${variable}">${variable}</span>&nbsp;`).run();
  };

  const ToolbarButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <Button
      type="button" variant="ghost" size="icon"
      className={cn("h-8 w-8", active && "bg-muted text-foreground")}
      onClick={onClick} title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className={cn("border rounded-md border-input bg-background", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input p-1.5">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrito">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Itálico">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Sublinhado">
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Alinhar à esquerda">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centralizar">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Alinhar à direita">
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer">
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Type className="h-3.5 w-3.5" />
              Inserir Variável
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            {AVAILABLE_VARIABLES.map((v) => (
              <DropdownMenuItem key={v.key} onClick={() => insertVariable(v.key)}>
                <span className="font-mono text-xs text-primary mr-2">{v.key}</span>
                <span className="text-muted-foreground text-xs">{v.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} className="prose prose-sm max-w-none p-4 min-h-[300px] focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[280px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none" />
    </div>
  );
}
