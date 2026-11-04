export type CourseStatus = 'published' | 'development' | 'draft'
export type ContentBlock = { type: 'paragraph' | 'heading' | 'subheading' | 'callout' | 'list'; text?: string; items?: string[] }
export type Course = { id: string; code: string; title: string; subtitle: string; summary: string; period: number; tracks: string[]; level: 'Iniciante' | 'Intermediário' | 'Avançado'; hours: number; status: CourseStatus; objectives: string[]; certificate?: boolean; isPilot?: boolean; updatedAt: string }
export type Module = { id: string; courseId: string; title: string; order: number; summary: string }
export type Video = { id: string; url: string; title: string; channel: string; status: 'candidate' | 'approved' }
export type Lesson = { id: string; courseId: string; moduleId: string; slug: string; title: string; intro: string; objectives: string[]; body: ContentBlock[]; references: string[]; minutes: number; order: number; visibility: 'published' | 'draft'; updatedAt: string; video?: Video; demoNote?: string }
export type Question = { id: string; courseId: string; prompt: string; options: string[]; answer: number; explanation: string }
export type Catalog = { courses: Course[]; modules: Module[]; lessons: Lesson[]; questions: Question[] }

const seed: Array<[string, string, string, string[], Course['level']]> = [
  ['D01', 'Introdução ao Estudo da Teologia', 'Perguntas, fontes, métodos e áreas do estudo teológico.', ['Conhecendo a Bíblia', 'Formação Teológica Básica'], 'Iniciante'],
  ['D02', 'Panorama do Antigo Testamento', 'Cânon, contextos, gêneros e movimentos do Antigo Testamento.', ['Conhecendo a Bíblia', 'Bíblia em Profundidade'], 'Iniciante'],
  ['D03', 'Panorama do Novo Testamento', 'Contexto greco-romano, Evangelhos, Atos, cartas e Apocalipse.', ['Conhecendo a Bíblia', 'Bíblia em Profundidade'], 'Iniciante'],
  ['D04', 'Como Interpretar a Bíblia', 'Gêneros, contexto, tradução, hermenêutica e aplicação.', ['Formação Teológica Básica'], 'Iniciante'],
  ['D05', 'Pentateuco e Origens de Israel', 'Narrativas, leis, alianças e questões de composição.', ['Bíblia em Profundidade'], 'Intermediário'],
  ['D06', 'História de Israel e do Antigo Oriente', 'Povos, reinos, exílio, retorno e memória histórica.', ['Bíblia em Profundidade', 'História e Pensamento Cristão'], 'Intermediário'],
  ['D07', 'Evangelhos e Vida de Jesus', 'Contexto, narrativas, ensino, paixão e ressurreição.', ['Bíblia em Profundidade'], 'Intermediário'],
  ['D08', 'Teologia Sistemática I', 'Método, revelação, doutrina de Deus e formulações históricas.', ['Formação Teológica Básica'], 'Intermediário'],
  ['D09', 'Literatura Poética e Sapiencial', 'Salmos, provérbios, Jó, Eclesiastes, poesia e sabedoria.', ['Bíblia em Profundidade'], 'Intermediário'],
  ['D10', 'Profetas do Antigo Testamento', 'Profetismo, justiça, alianças, esperança e gêneros proféticos.', ['Bíblia em Profundidade'], 'Intermediário'],
  ['D11', 'Atos e Epístolas Paulinas', 'Comunidades, viagens, cartas, contextos e debates paulinos.', ['Bíblia em Profundidade'], 'Intermediário'],
  ['D12', 'Teologia Sistemática II', 'Cristologia, pneumatologia, antropologia e soteriologia.', ['Formação Teológica Básica'], 'Intermediário'],
  ['D13', 'Epístolas Gerais e Apocalipse', 'Hebreus, cartas gerais, apocalipse e leituras responsáveis.', ['Bíblia em Profundidade'], 'Intermediário'],
  ['D14', 'História da Igreja I', 'Igreja antiga, concílios, medievo e cristianismos históricos.', ['História e Pensamento Cristão'], 'Intermediário'],
  ['D15', 'História da Igreja II', 'Reformas, protestantismos, pentecostalismos e cristianismo no mundo.', ['História e Pensamento Cristão'], 'Intermediário'],
  ['D16', 'Teologia Sistemática III', 'Igreja, sacramentos, escatologia e leituras comparadas.', ['Formação Teológica Básica'], 'Intermediário'],
  ['D17', 'Hebraico Bíblico I', 'Alfabeto, leitura, formas e noções iniciais de gramática.', ['Idiomas Bíblicos e Pesquisa'], 'Avançado'],
  ['D18', 'Grego do Novo Testamento I', 'Alfabeto, substantivos, verbos e pequenas leituras acompanhadas.', ['Idiomas Bíblicos e Pesquisa'], 'Avançado'],
  ['D19', 'Exegese Bíblica Aplicada', 'Observação, contexto, análise e comunicação responsável.', ['Idiomas Bíblicos e Pesquisa', 'Ministério e Ensino'], 'Avançado'],
  ['D20', 'Ética Cristã e Questões Contemporâneas', 'Discernimento ético, fontes e responsabilidade comunitária.', ['Ministério e Ensino'], 'Intermediário'],
  ['D21', 'Homilética', 'Preparação, estrutura e entrega de exposições bíblicas.', ['Ministério e Ensino'], 'Intermediário'],
  ['D22', 'Didática do Ensino Bíblico', 'Planejamento, aprendizagem, inclusão e avaliação formativa.', ['Ministério e Ensino'], 'Intermediário'],
  ['D23', 'Teologia Pastoral e Limites do Aconselhamento', 'Cuidado, ética, encaminhamento e limites profissionais.', ['Ministério e Ensino'], 'Intermediário'],
  ['D24', 'Teologia da Adoração e Música Cristã', 'Culto, história, tradições e projeto integrador.', ['História e Pensamento Cristão', 'Ministério e Ensino'], 'Intermediário'],
]

const d01Modules = ['O que estudamos quando estudamos teologia?', 'Escrituras, história e tradição', 'Método, fontes e responsabilidade', 'Áreas da teologia e projeto de pesquisa']
const pilotNotice = 'Material inicial de demonstração - revisar antes de publicar.'

function blocks(...items: ContentBlock[]) { return items }

const pilotLessons: Lesson[] = [
  { id: 'd01-l01', courseId: 'd01', moduleId: 'd01-m01', slug: 'o-que-e-teologia', title: 'O que é teologia?', order: 1, minutes: 12, visibility: 'published', updatedAt: '2026-11-04', demoNote: pilotNotice, intro: 'O que distingue estudar teologia de apenas reunir opiniões sobre Deus?', objectives: ['Definir teologia como investigação organizada.', 'Distinguir áreas do estudo teológico.', 'Reconhecer diferentes pressupostos metodológicos.'], body: blocks(
    { type: 'heading', text: 'Uma investigação organizada' },
    { type: 'paragraph', text: 'Teologia é uma investigação organizada das crenças, textos, práticas e tradições que tratam de Deus e da relação entre o sagrado, o ser humano e o mundo. Na tradição cristã, ela costuma partir das Escrituras e dialogar com a experiência de fé, a comunidade interpretativa e instrumentos da pesquisa histórica e filosófica.' },
    { type: 'callout', text: 'Uma plataforma séria informa o método empregado e diferencia texto bíblico, comentário, reconstrução histórica e convicção confessional.' },
    { type: 'heading', text: 'Áreas que fazem perguntas diferentes' },
    { type: 'list', items: ['Teologia bíblica investiga temas e desenvolvimentos dentro dos escritos bíblicos.', 'Teologia sistemática organiza conceitos doutrinários em temas interligados.', 'Teologia histórica acompanha formulações de ideias ao longo do tempo.', 'Teologia prática reflete sobre ensino, culto, cuidado comunitário e ação social.'] },
    { type: 'paragraph', text: 'Atividade: escolha a pergunta “o que significa aliança nas Escrituras?” e descreva como cada área poderia investigá-la. O objetivo é identificar métodos, não memorizar slogans.' },
    { type: 'paragraph', text: 'Síntese: teologia exige pergunta clara, fontes identificáveis, leitura contextual e honestidade diante de divergências.' },
  ), references: ['Texto-semente autoral da Bíblia Mestre v2.0. Revisão humana pendente.'] },
  { id: 'd01-l02', courseId: 'd01', moduleId: 'd01-m02', slug: 'escrituras-historia-tradicao', title: 'Escrituras, história, tradição e interpretação', order: 2, minutes: 14, visibility: 'published', updatedAt: '2026-11-04', demoNote: pilotNotice, intro: 'Como saber se uma afirmação teológica está bem fundamentada?', objectives: ['Nomear fontes de uma afirmação.', 'Diferenciar tradução, observação e interpretação.', 'Organizar uma nota de estudo verificável.'], body: blocks(
    { type: 'heading', text: 'Nomeie a fonte' },
    { type: 'paragraph', text: 'Para estudar uma passagem bíblica, é necessário distinguir o texto efetivamente lido, a tradução utilizada, o gênero literário, o contexto da unidade e aquilo que um intérprete concluiu. “O texto diz” e “uma tradição interpreta” não são afirmações equivalentes.' },
    { type: 'paragraph', text: 'Tradições protestantes geralmente afirmam uma elevada autoridade das Escrituras, mas não são idênticas em seus métodos. A pesquisa acadêmica pode contribuir com dados sobre línguas antigas, manuscritos, geografia e instituições; evidências documentais, hipóteses e aplicações pastorais devem permanecer identificáveis.' },
    { type: 'callout', text: 'Autoridade não cresce porque uma frase é repetida; cresce quando seu fundamento é indicado e pode ser avaliado.' },
    { type: 'list', items: ['Leia o parágrafo completo em uma tradução legalmente utilizada.', 'Identifique personagens, lugar, conflito e público.', 'Registre observação textual, informação externa, hipótese e aplicação.', 'Indique autor, obra e localização de cada fonte consultada.'] },
  ), references: ['Texto-semente autoral da Bíblia Mestre v2.0. Revisão humana pendente.'] },
  { id: 'd01-l03', courseId: 'd01', moduleId: 'd01-m03', slug: 'pesquisar-sem-perder-o-sentido', title: 'Como pesquisar sem perder o sentido do texto', order: 3, minutes: 15, visibility: 'published', updatedAt: '2026-11-04', demoNote: pilotNotice, intro: 'Como evitar colocar no texto bíblico aquilo que desejamos encontrar?', objectives: ['Aplicar um método inicial de leitura contextual.', 'Reconhecer a falácia lexical.', 'Separar observação, inferência e aplicação.'], body: blocks(
    { type: 'heading', text: 'Leitura atenta antes de conclusões' },
    { type: 'paragraph', text: 'A interpretação parte de uma leitura atenta e contextual, não da seleção de frases convenientes. A investigação observa o argumento do capítulo, o gênero literário e o contexto histórico possível. Em passagens controversas, comparar interpretações é útil quando cada posição é apresentada por fontes que de fato a representam.' },
    { type: 'subheading', text: 'Duas armadilhas frequentes' },
    { type: 'list', items: ['Falácia lexical: supor que uma palavra carrega todos os sentidos de um dicionário em cada ocorrência.', 'Anacronismo: aplicar diretamente ao presente um texto antigo sem demonstrar a passagem entre contextos.'] },
    { type: 'heading', text: 'Método inicial de seis etapas' },
    { type: 'list', items: ['Leia a unidade inteira.', 'Marque palavras-chave e conectivos.', 'Identifique gênero e destinatários.', 'Consulte contexto histórico e tradução.', 'Compare interpretações relevantes.', 'Sintetize distinguindo observação, inferência e aplicação.'] },
    { type: 'callout', text: 'Rigor acadêmico e convicção cristã não exigem ocultar dificuldades.' },
  ), references: ['Texto-semente autoral da Bíblia Mestre v2.0. Revisão humana pendente.'] },
]

const miniLessons: Lesson[] = [
  { id: 'mini-l01', courseId: 'mini-metodo', moduleId: 'mini-m01', slug: 'ler-a-unidade', title: 'Ler a unidade inteira', order: 1, minutes: 6, visibility: 'published', updatedAt: '2026-11-04', intro: 'Uma etapa prática para começar uma leitura responsável.', objectives: ['Delimitar uma unidade de leitura.'], body: blocks({ type: 'heading', text: 'Antes da citação' }, { type: 'paragraph', text: 'Leia um parágrafo inteiro antes de isolar uma frase. Observe quem fala, a quem se fala e como as ideias se conectam. Registrar esse contexto simples protege a leitura de conclusões precipitadas.' }, { type: 'callout', text: 'Este minicurso é uma demonstração técnica de fluxo; não substitui formação teológica completa.' }), references: ['Material autoral de demonstração.'] },
  { id: 'mini-l02', courseId: 'mini-metodo', moduleId: 'mini-m01', slug: 'distinguir-observacao-e-inferencia', title: 'Distinguir observação e inferência', order: 2, minutes: 6, visibility: 'published', updatedAt: '2026-11-04', intro: 'Organize o que aparece no texto antes de defender uma leitura.', objectives: ['Separar observação e interpretação.'], body: blocks({ type: 'heading', text: 'Duas colunas úteis' }, { type: 'paragraph', text: 'Em uma coluna, descreva palavras, personagens, repetições e conexões. Em outra, registre hipóteses de interpretação com suas razões. A separação torna a conversa mais honesta e revisável.' }), references: ['Material autoral de demonstração.'] },
  { id: 'mini-l03', courseId: 'mini-metodo', moduleId: 'mini-m01', slug: 'registrar-fontes', title: 'Registrar fontes e próximos passos', order: 3, minutes: 6, visibility: 'published', updatedAt: '2026-11-04', intro: 'A verificabilidade faz parte do aprendizado.', objectives: ['Criar uma nota de fontes básica.'], body: blocks({ type: 'heading', text: 'Uma nota recuperável' }, { type: 'paragraph', text: 'Anote tradução, autor, obra, edição ou URL e a parte consultada. Depois, escreva a dúvida que permanece. Fontes identificadas permitem revisão, correção e aprofundamento sem apresentar opinião como fato.' }, { type: 'callout', text: 'Conclua o questionário para testar o fluxo de avaliação deste ambiente demonstrativo.' }), references: ['Material autoral de demonstração.'] },
]

export function createInitialCatalog(): Catalog {
  const courses: Course[] = seed.map(([code, title, summary, tracks, level], i) => ({ id: code.toLowerCase(), code, title, subtitle: `Disciplina ${code} do itinerário livre`, summary, tracks, level, period: Math.floor(i / 4) + 1, hours: 24, status: code === 'D01' ? 'published' : 'development', objectives: ['Construir vocabulário básico.', 'Ler fontes com responsabilidade.', 'Relacionar conteúdo e contexto.'], updatedAt: '2026-11-04' }))
  courses.push({ id: 'mini-metodo', code: 'PILOTO', title: 'Minicurso: leitura responsável', subtitle: 'Piloto técnico para avaliação e certificado de demonstração', summary: 'Três aulas curtas, avaliação e emissão local de certificado marcado como demonstração.', tracks: ['Conhecendo a Bíblia'], level: 'Iniciante', period: 0, hours: 1, status: 'published', objectives: ['Ler uma unidade em contexto.', 'Distinguir observação e inferência.', 'Registrar fontes consultadas.'], certificate: true, isPilot: true, updatedAt: '2026-11-04' })
  const modules: Module[] = courses.flatMap((course) => course.id === 'mini-metodo'
    ? [{ id: 'mini-m01', courseId: course.id, title: 'Prática inicial de leitura', order: 1, summary: 'Minicurso fechado de teste.' }]
    : Array.from({ length: 4 }, (_, i) => ({ id: `${course.id}-m0${i + 1}`, courseId: course.id, title: course.code === 'D01' ? d01Modules[i] : `Unidade ${i + 1}: estudo orientado`, order: i + 1, summary: `Módulo programado de ${course.title}. Será publicado quando possuir texto revisado, referências e atividades.` })))
  return { courses, modules, lessons: [...pilotLessons, ...miniLessons], questions: [
    { id: 'mini-q1', courseId: 'mini-metodo', prompt: 'Antes de usar uma frase como base para uma conclusão, o passo inicial é:', options: ['Ler a unidade inteira.', 'Memorizar palavras difíceis.', 'Buscar uma resposta pronta.', 'Ignorar o contexto.'], answer: 0, explanation: 'Ler a unidade inteira situa a frase no argumento e no contexto.' },
    { id: 'mini-q2', courseId: 'mini-metodo', prompt: 'Qual prática torna uma afirmação mais verificável?', options: ['Omitir a fonte.', 'Registrar autor, obra ou URL e localização.', 'Repetir a afirmação.', 'Usar apenas uma imagem.'], answer: 1, explanation: 'Uma fonte identificada permite conferência, correção e aprofundamento.' },
    { id: 'mini-q3', courseId: 'mini-metodo', prompt: 'Observação textual e interpretação são:', options: ['Sempre idênticas.', 'Etapas relacionadas, mas diferentes.', 'Sem utilidade.', 'Proibidas em cursos livres.'], answer: 1, explanation: 'Separar o que se observa do que se infere traz clareza ao estudo.' },
  ] }
}
