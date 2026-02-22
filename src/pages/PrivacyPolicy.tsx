const PrivacyPolicy = () => {
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Política de Privacidade</h1>
      <p className="text-muted-foreground mb-4">Última atualização: 22 de fevereiro de 2026</p>

      <section className="space-y-4 text-sm leading-relaxed">
        <h2 className="text-xl font-semibold mt-6">1. Informações que coletamos</h2>
        <p>
          Coletamos informações que você nos fornece diretamente, como nome, e-mail e telefone ao criar
          uma conta ou utilizar nossos serviços. Também podemos coletar dados de uso, como páginas visitadas
          e interações com funcionalidades do sistema.
        </p>

        <h2 className="text-xl font-semibold mt-6">2. Uso das informações</h2>
        <p>Utilizamos suas informações para:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Fornecer, manter e melhorar nossos serviços</li>
          <li>Processar transações e gerenciar sua conta</li>
          <li>Enviar comunicações relevantes sobre o serviço</li>
          <li>Integrar com serviços de terceiros conforme autorizado (ex: Meta Ads)</li>
          <li>Cumprir obrigações legais</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">3. Compartilhamento de dados</h2>
        <p>
          Não vendemos seus dados pessoais. Podemos compartilhar informações com prestadores de
          serviço que nos auxiliam na operação da plataforma, sempre sob acordos de confidencialidade.
          Quando você conecta serviços de terceiros (como Meta/Facebook), os dados são compartilhados
          conforme as permissões que você autoriza.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Integrações com terceiros</h2>
        <p>
          Nosso sistema permite integrações com plataformas como Meta Ads. Ao conectar sua conta,
          acessamos dados de campanhas, anúncios e leads conforme as permissões concedidas. Você pode
          revogar o acesso a qualquer momento nas configurações da plataforma.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Segurança</h2>
        <p>
          Empregamos medidas técnicas e organizacionais para proteger seus dados contra acesso não
          autorizado, alteração, divulgação ou destruição. Todos os dados são transmitidos via HTTPS
          e armazenados com criptografia adequada.
        </p>

        <h2 className="text-xl font-semibold mt-6">6. Seus direitos (LGPD)</h2>
        <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem o direito de:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Acessar seus dados pessoais</li>
          <li>Corrigir dados incompletos ou desatualizados</li>
          <li>Solicitar a exclusão de seus dados</li>
          <li>Revogar consentimento a qualquer momento</li>
          <li>Solicitar portabilidade dos dados</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">7. Retenção de dados</h2>
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para prestar
          nossos serviços. Após encerramento da conta, os dados são removidos em até 30 dias,
          exceto quando exigido por lei.
        </p>

        <h2 className="text-xl font-semibold mt-6">8. Contato</h2>
        <p>
          Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato
          pelo e-mail: <a href="mailto:contato@portadocorretor.com.br" className="text-primary underline">contato@portadocorretor.com.br</a>
        </p>

        <h2 className="text-xl font-semibold mt-6">9. Alterações</h2>
        <p>
          Esta política pode ser atualizada periodicamente. Notificaremos sobre alterações
          significativas através do sistema ou por e-mail.
        </p>
      </section>
    </main>
  );
};

export default PrivacyPolicy;
