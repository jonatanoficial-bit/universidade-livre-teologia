# Free University of Theology

MVP de uma plataforma gratuita de cursos livres em teologia. O projeto trata a leitura como centro da aula, não cria paywall e separa cuidadosamente o catálogo planejado do conteúdo realmente publicado.

> Marca pública provisória. Antes de divulgar a marca, emitir certificados institucionais ou usar o nome de uma entidade emissora, faça a validação jurídica e institucional correspondente. Cursos livres não são diplomas de graduação nem reconhecimento pelo MEC.

## Entregue neste repositório

- Aplicação React + Vite + TypeScript responsiva, com rotas por hash adequadas ao GitHub Pages.
- Catálogo estruturado de 6 períodos, 24 disciplinas e 96 módulos. As 93 unidades sem texto aparecem como **Em desenvolvimento**, nunca como aulas disponíveis.
- Três aulas-piloto autorais no curso D01: texto orientado, objetivos, leitura por seções, referências e notas editoriais de revisão pendente.
- Minicurso fechado para testar conclusão, avaliação formativa e certificado de **demonstração**.
- Leitor com índice, navegação entre aulas, tamanho de fonte, tema, progresso e anotações sincronizáveis por conta.
- Vídeo do YouTube opcional e seguro: aceita apenas ID ou URL HTTPS de domínios YouTube, cria player após clique e mantém link alternativo para a origem.
- Painel editorial demonstrativo: novo curso, módulo, aula por blocos estruturados, rascunho, prévia, publicação/despublicação, importação e exportação JSON.
- PWA simples com cache local do shell do app, manifesto e ícone próprio.
- Migração Supabase com Auth, RLS, progresso, anotações, tentativas e fila de avaliação docente, além do workflow de deploy para GitHub Pages.

## Executar localmente

```bash
pnpm install
pnpm dev
```

Para validar a entrega:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Fluxos demonstráveis

### Visitante

1. Abra `#/cursos` e pesquise uma disciplina.
2. Entre em **Introdução ao Estudo da Teologia** e abra uma das três aulas publicadas, sem login.
3. Ajuste a fonte, leia a aula e avance para a próxima.
4. Note que o vídeo não é carregado sem uma ação explícita e que o texto continua útil sem ele.

### Estudante

1. Use `#/entrar`, crie uma conta gratuita com e-mail e confirme o endereço.
2. Conclua as três aulas do minicurso `#/curso/mini-metodo`.
3. Responda à avaliação com 70% ou mais.
4. Progresso, notas, tentativas e eventuais devolutivas aparecem em **Meu campus**.

### Professora ou professor

1. Um administrador atribui o papel `teacher` e os cursos sob sua responsabilidade.
2. Entre normalmente e abra **Avaliações**.
3. Leia cada tentativa autorizada e publique uma devolutiva acadêmica para o estudante.

## Autenticação e persistência

O app usa Supabase Auth (e-mail/senha) e PostgreSQL quando as variáveis públicas do cliente e a migração estão configuradas. A tela de acesso informa claramente quando a conexão ainda não foi ativada; não existe mais atalho de "conta demonstrativa".

O banco aplica Row Level Security: estudantes só veem e alteram registros próprios; docentes só leem e avaliam tentativas dos cursos que lhes foram atribuídos; papéis são definidos no banco, nunca no `user_metadata` ou no navegador. A emissão de certificados continua deliberadamente local e marcada como demonstração.

## Ativação em produção

1. No Supabase, ative ou crie um projeto e aplique `supabase/migrations/20261123120905_learning_identity_and_assessments.sql` com `supabase db push` depois de vinculá-lo pela CLI.
2. Em **Auth → URL configuration**, configure o Site URL e adicione `https://jonatanoficial-bit.github.io/universidade-livre-teologia/` às Redirect URLs.
3. Copie `.env.example` para `.env.local` e preencha somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca use no frontend uma chave `service_role` ou secreta.
4. Em GitHub → **Settings → Secrets and variables → Actions → Variables**, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O workflow já usa essas variáveis na compilação do Pages.
5. Depois da primeira conta criada, atribua funções administrativamente pelo SQL Editor: `update public.profiles set role = 'teacher' where id = '<uuid-do-usuario>';`. Para liberar uma disciplina: `insert into public.teacher_course_assignments (teacher_id, course_id) values ('<uuid-do-professor>', 'mini-metodo');`.
6. Execute os advisors de segurança do Supabase após aplicar a migração e antes de abrir inscrições públicas.
7. Configure entidade emissora, texto jurídico, política de privacidade, idade atendida e processo de revogação antes de habilitar certificado público verificável.

## Modelo de conteúdo e importação

O painel exporta o formato completo em JSON. Para importar, o arquivo precisa conter as coleções `courses`, `modules`, `lessons` e, opcionalmente, `questions`. IDs estáveis são usados para substituir registros existentes; aulas importadas entram sempre como rascunho. O conteúdo é renderizado em blocos estruturados - parágrafos, títulos, listas e chamadas de atenção - e não aceita HTML arbitrário.

## Segurança e privacidade

- Validação de URL impede `javascript:`, iframes colados e hosts que não sejam YouTube.
- Links externos devem usar `rel="noopener noreferrer"`.
- As políticas RLS do Supabase recusam elevação de papel no cliente e separam os dados de estudantes da fila docente.
- Anotações, progresso e tentativas pertencem exclusivamente ao respectivo UID; professores acessam apenas as tentativas dos cursos atribuídos.
- O cache PWA é apenas para assets estáticos e não promete vídeo offline nem substitui backup.

## Decisões de produto

O conteúdo inicial é propositalmente pequeno: há três aulas-piloto e um minicurso técnico. A matriz de 24 disciplinas existe como planejamento curricular, mas nenhuma aula vazia ou referência fictícia é apresentada como publicada. A expansão editorial deve seguir lotes revisados, com autoria, referências, data, direitos e revisão humana registrados no CMS.
