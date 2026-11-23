import { useEffect, useState, type FormEvent } from "react";
import {
  createInitialCatalog,
  type Catalog,
  type ContentBlock,
  type Course,
  type Lesson,
} from "./data";
import {
  isSupabaseConfigured,
  supabase,
  type AppRole,
  type RemoteProfile,
  type TeacherAttempt,
} from "./lib/supabase";
import { parseYouTubeVideo } from "./lib/youtube";
import "./App.css";

type Account = { id: string; name: string; email: string; role: AppRole };
type Progress = Record<string, { completed: boolean; savedAt: string }>;
type QuizResult = Record<
  string,
  {
    score: number;
    passed: boolean;
    attemptId?: string;
    feedback?: string | null;
    reviewedAt?: string | null;
  }
>;
type AuthStatus = "checking" | "ready" | "unconfigured";
type Certificate = {
  courseId: string;
  name: string;
  issuedAt: string;
  token: string;
};
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const path = () => window.location.hash.replace(/^#/, "") || "/";
const blocksFromText = (value: string): ContentBlock[] =>
  value
    .split("\n")
    .filter(Boolean)
    .map((line) =>
      line.startsWith("## ")
        ? { type: "subheading", text: line.slice(3) }
        : line.startsWith("# ")
          ? { type: "heading", text: line.slice(2) }
          : line.startsWith("! ")
            ? { type: "callout", text: line.slice(2) }
            : line.startsWith("- ")
              ? { type: "list", items: [line.slice(2)] }
              : { type: "paragraph", text: line },
    );
const statusLabel = (status: Course["status"]) =>
  status === "published"
    ? "Publicado"
    : status === "draft"
      ? "Rascunho"
      : "Em desenvolvimento";

function RichText({
  blocks,
  fontScale,
}: {
  blocks: ContentBlock[];
  fontScale: number;
}) {
  return (
    <div className="rich-text" style={{ fontSize: `${fontScale}rem` }}>
      {blocks.map((block, index) => {
        if (block.type === "heading")
          return (
            <h2 id={`section-${index}`} key={index}>
              {block.text}
            </h2>
          );
        if (block.type === "subheading")
          return (
            <h3 id={`section-${index}`} key={index}>
              {block.text}
            </h3>
          );
        if (block.type === "callout")
          return (
            <aside className="callout" key={index}>
              ✦ {block.text}
            </aside>
          );
        if (block.type === "list")
          return (
            <ul key={index}>
              {block.items?.map((item) => <li key={item}>{item}</li>)}
            </ul>
          );
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}
function Status({ status }: { status: Course["status"] }) {
  return <span className={`status ${status}`}>{statusLabel(status)}</span>;
}

function App() {
  const [route, setRoute] = useState(path);
  const [catalog, setCatalog] = useState<Catalog>(() =>
    store.get("ult-catalog", createInitialCatalog()),
  );
  const [account, setAccount] = useState<Account | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "checking" : "unconfigured",
  );
  const [syncMessage, setSyncMessage] = useState("");
  const [teacherAttempts, setTeacherAttempts] = useState<TeacherAttempt[]>([]);
  const [progress, setProgress] = useState<Progress>(() =>
    store.get("ult-progress", {}),
  );
  const [results, setResults] = useState<QuizResult>(() =>
    store.get("ult-results", {}),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    store.get("ult-notes", {}),
  );
  const [certificates, setCertificates] = useState<Certificate[]>(() =>
    store.get("ult-certificates", []),
  );
  const [dark, setDark] = useState(() => store.get("ult-dark", false));
  const [fontScale, setFontScale] = useState(() =>
    store.get("ult-font-scale", 1),
  );
  useEffect(() => {
    const update = () => setRoute(path());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => store.set("ult-catalog", catalog), [catalog]);
  useEffect(() => store.set("ult-progress", progress), [progress]);
  useEffect(() => store.set("ult-results", results), [results]);
  useEffect(() => store.set("ult-notes", notes), [notes]);
  useEffect(() => store.set("ult-certificates", certificates), [certificates]);
  useEffect(() => {
    store.set("ult-dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => store.set("ult-font-scale", fontScale), [fontScale]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let mounted = true;
    const restoreUser = async (
      user: {
        id: string;
        email?: string | null;
      } | null,
    ) => {
      if (!user) {
        if (mounted) {
          setAccount(null);
          setTeacherAttempts([]);
          setAuthStatus("ready");
        }
        return;
      }

      const profileResponse = await client
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();
      if (profileResponse.error || !profileResponse.data) {
        if (mounted) {
          setSyncMessage(
            "Não foi possível carregar seu perfil. Confirme se a migração do banco foi aplicada.",
          );
          setAuthStatus("ready");
        }
        return;
      }

      const profile = profileResponse.data as RemoteProfile;
      const nextAccount: Account = {
        id: user.id,
        name: profile.full_name,
        email: user.email ?? "",
        role: profile.role,
      };
      const [progressResponse, notesResponse, attemptsResponse] =
        await Promise.all([
          client
            .from("learning_progress")
            .select("lesson_id, completed, completed_at")
            .eq("user_id", user.id),
          client
            .from("lesson_notes")
            .select("lesson_id, body")
            .eq("user_id", user.id),
          client
            .from("assessment_attempts")
            .select(
              "id, course_id, score, passed, teacher_feedback, reviewed_at, submitted_at",
            )
            .eq("student_id", user.id)
            .order("submitted_at", { ascending: false }),
        ]);

      if (!mounted) return;
      if (window.location.hash.includes("access_token=")) {
        window.location.hash = "/";
      }
      setAccount(nextAccount);
      setAuthStatus("ready");
      if (
        progressResponse.error ||
        notesResponse.error ||
        attemptsResponse.error
      ) {
        setSyncMessage(
          "Sua conta foi aberta, mas parte do histórico não pôde ser sincronizada agora.",
        );
      }
      const remoteProgress: Progress = {};
      for (const item of progressResponse.data ?? []) {
        remoteProgress[item.lesson_id as string] = {
          completed: Boolean(item.completed),
          savedAt: item.completed_at as string,
        };
      }
      setProgress(remoteProgress);
      const remoteNotes: Record<string, string> = {};
      for (const item of notesResponse.data ?? []) {
        remoteNotes[item.lesson_id as string] = item.body as string;
      }
      setNotes(remoteNotes);
      const remoteResults: QuizResult = {};
      for (const item of attemptsResponse.data ?? []) {
        const courseId = item.course_id as string;
        if (!remoteResults[courseId]) {
          remoteResults[courseId] = {
            score: item.score as number,
            passed: item.passed as boolean,
            attemptId: item.id as string,
            feedback: item.teacher_feedback as string | null,
            reviewedAt: item.reviewed_at as string | null,
          };
        }
      }
      setResults(remoteResults);

      if (profile.role === "teacher" || profile.role === "admin") {
        const queueResponse = await client
          .from("assessment_attempts")
          .select(
            "id, student_id, student_name, course_id, score, passed, submitted_at, teacher_feedback, reviewer_id, reviewed_at",
          )
          .order("submitted_at", { ascending: false });
        if (mounted && !queueResponse.error) {
          setTeacherAttempts(queueResponse.data as TeacherAttempt[]);
        }
      }
    };

    void client.auth.getUser().then(({ data }) => restoreUser(data.user));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      void restoreUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const courseById = (id: string) =>
    catalog.courses.find((course) => course.id === id);
  const lessonsFor = (courseId: string) =>
    catalog.lessons
      .filter(
        (lesson) =>
          lesson.courseId === courseId && lesson.visibility === "published",
      )
      .sort((a, b) => a.order - b.order);
  const markComplete = (id: string) => {
    setProgress((value) => ({
      ...value,
      [id]: { completed: true, savedAt: new Date().toISOString() },
    }));
    const lesson = catalog.lessons.find((candidate) => candidate.id === id);
    if (supabase && account && lesson) {
      void supabase
        .from("learning_progress")
        .upsert(
          {
            user_id: account.id,
            lesson_id: id,
            course_id: lesson.courseId,
            completed: true,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,lesson_id" },
        )
        .then(({ error }) => {
          if (error)
            setSyncMessage(
              "A aula foi marcada neste dispositivo, mas não foi possível sincronizá-la.",
            );
        });
    }
  };
  const updateNote = (lessonId: string, body: string) =>
    setNotes((value) => ({ ...value, [lessonId]: body }));
  const saveNote = (lessonId: string, body: string) => {
    updateNote(lessonId, body);
    if (!supabase || !account) return;
    void supabase
      .from("lesson_notes")
      .upsert(
        { user_id: account.id, lesson_id: lessonId, body },
        { onConflict: "user_id,lesson_id" },
      )
      .then(({ error }) => {
        if (error)
          setSyncMessage(
            "A anotação foi mantida neste dispositivo, mas não foi sincronizada.",
          );
      });
  };
  const recordAssessment = (
    courseId: string,
    score: number,
    answers: Record<string, number>,
  ) => {
    const result = { score, passed: score >= 70 };
    setResults((value) => ({ ...value, [courseId]: result }));
    if (!supabase || !account) return;
    void supabase
      .from("assessment_attempts")
      .insert({
        student_id: account.id,
        student_name: account.name,
        course_id: courseId,
        score,
        passed: result.passed,
        answers,
      })
      .select("id, teacher_feedback, reviewed_at")
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setSyncMessage(
            "O resultado foi mostrado neste dispositivo, mas não foi enviado para avaliação.",
          );
          return;
        }
        setResults((value) => ({
          ...value,
          [courseId]: {
            ...result,
            attemptId: data.id as string,
            feedback: data.teacher_feedback as string | null,
            reviewedAt: data.reviewed_at as string | null,
          },
        }));
      });
  };
  const submitLogin = async (email: string, password: string) => {
    if (!supabase)
      return "A conexão de autenticação ainda não foi configurada.";
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return error.message;
    navigate("/meu-campus");
    return null;
  };
  const submitRegistration = async (
    name: string,
    email: string,
    password: string,
  ) => {
    if (!supabase)
      return "A conexão de autenticação ainda não foi configurada.";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) return error.message;
    if (!data.session)
      return "Conta criada. Confira seu e-mail para confirmar o acesso antes de entrar.";
    navigate("/meu-campus");
    return null;
  };
  const publishFeedback = async (attemptId: string, feedback: string) => {
    if (!supabase || !account)
      return "Sessão indisponível para publicar a avaliação.";
    const { data, error } = await supabase
      .from("assessment_attempts")
      .update({
        teacher_feedback: feedback,
        reviewer_id: account.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", attemptId)
      .select(
        "id, student_id, student_name, course_id, score, passed, submitted_at, teacher_feedback, reviewer_id, reviewed_at",
      )
      .single();
    if (error || !data)
      return error?.message ?? "Não foi possível publicar a devolutiva.";
    setTeacherAttempts((attempts) =>
      attempts.map((attempt) =>
        attempt.id === attemptId ? (data as TeacherAttempt) : attempt,
      ),
    );
    return null;
  };
  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setAccount(null);
    setTeacherAttempts([]);
    navigate("/");
  };
  const shared = {
    catalog,
    setCatalog,
    account,
    progress,
    results,
    notes,
    certificates,
    recordAssessment,
    setNotes,
    updateNote,
    saveNote,
    setCertificates,
    navigate,
    courseById,
    lessonsFor,
    markComplete,
    fontScale,
    setFontScale,
    dark,
    setDark,
    authStatus,
    syncMessage,
  };
  const parts = route.split("/").filter(Boolean);
  let page: React.ReactNode;
  if (route === "/") page = <Home {...shared} />;
  else if (route === "/cursos") page = <CatalogPage {...shared} />;
  else if (parts[0] === "curso" && parts[1])
    page = <CoursePage {...shared} courseId={parts[1]} />;
  else if (parts[0] === "estudar" && parts[1] && parts[2])
    page = <Reader {...shared} courseId={parts[1]} lessonSlug={parts[2]} />;
  else if (route === "/entrar")
    page = (
      <Login
        authStatus={authStatus}
        login={submitLogin}
        register={submitRegistration}
      />
    );
  else if (route.startsWith("/meu-campus"))
    page = <Campus {...shared} logout={logout} />;
  else if (route === "/avaliacoes")
    page = (
      <TeacherReviews
        account={account}
        attempts={teacherAttempts}
        catalog={catalog}
        navigate={navigate}
        publishFeedback={publishFeedback}
      />
    );
  else if (route === "/admin") page = <Admin {...shared} />;
  else if (parts[0] === "certificado" && parts[1])
    page = <CertificatePage {...shared} courseId={parts[1]} />;
  else if (parts[0] === "verificar")
    page = <Verification certificates={certificates} token={parts[1] ?? ""} />;
  else page = <Institutional route={route} />;
  return (
    <div className="app-shell">
      <a className="skip" href="#content">
        Pular para o conteúdo
      </a>
      <Header
        account={account}
        dark={dark}
        navigate={navigate}
        logout={logout}
        setDark={setDark}
      />
      <main id="content">{page}</main>
      <Footer navigate={navigate} />
    </div>
  );
}

type Shared = {
  catalog: Catalog;
  setCatalog: (value: Catalog) => void;
  account: Account | null;
  progress: Progress;
  results: QuizResult;
  notes: Record<string, string>;
  certificates: Certificate[];
  recordAssessment: (
    courseId: string,
    score: number,
    answers: Record<string, number>,
  ) => void;
  setNotes: (value: Record<string, string>) => void;
  updateNote: (lessonId: string, body: string) => void;
  saveNote: (lessonId: string, body: string) => void;
  setCertificates: (value: Certificate[]) => void;
  navigate: (to: string) => void;
  courseById: (id: string) => Course | undefined;
  lessonsFor: (id: string) => Lesson[];
  markComplete: (id: string) => void;
  fontScale: number;
  setFontScale: (value: number) => void;
  dark: boolean;
  setDark: (value: boolean) => void;
  authStatus: AuthStatus;
  syncMessage: string;
};

function Header({
  account,
  dark,
  navigate,
  logout,
  setDark,
}: {
  account: Account | null;
  dark: boolean;
  navigate: (path: string) => void;
  logout: () => void;
  setDark: (value: boolean) => void;
}) {
  return (
    <header className="topbar">
      <button
        className="brand"
        onClick={() => navigate("/")}
        aria-label="Free University of Theology, início"
      >
        <span className="brand-mark">
          <img src={`${import.meta.env.BASE_URL}images/fut-crest.png`} alt="" />
        </span>
        <b>
          Free University
          <br />
          <em>of Theology</em>
        </b>
      </button>
      <nav aria-label="Navegação principal">
        <button onClick={() => navigate("/cursos")}>Cursos</button>
        <button onClick={() => navigate("/trilhas")}>Trilhas</button>
        <button onClick={() => navigate("/biblioteca")}>Biblioteca</button>
        <button onClick={() => navigate("/metodologia")}>Metodologia</button>
      </nav>
      <div className="header-actions">
        <button
          className="icon-button"
          onClick={() => setDark(!dark)}
          aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
        >
          {dark ? "☀" : "◐"}
        </button>
        {account ? (
          <>
            <button
              className="account-button"
              onClick={() => navigate("/meu-campus")}
            >
              {account.name.split(" ")[0]}
            </button>
            {(account.role === "editor" || account.role === "admin") && (
              <button className="quiet" onClick={() => navigate("/admin")}>
                Painel
              </button>
            )}
            {(account.role === "teacher" || account.role === "admin") && (
              <button className="quiet" onClick={() => navigate("/avaliacoes")}>
                Avaliações
              </button>
            )}
            <button className="quiet" onClick={logout}>
              Sair
            </button>
          </>
        ) : (
          <button className="outline" onClick={() => navigate("/entrar")}>
            Entrar
          </button>
        )}
      </div>
    </header>
  );
}
function Footer({ navigate }: { navigate: (to: string) => void }) {
  return (
    <footer>
      <div>
        <strong>Free University of Theology</strong>
        <p>
          Educação teológica gratuita, com leitura orientada e conteúdo em
          expansão.
        </p>
      </div>
      <div className="footer-links">
        <button onClick={() => navigate("/politica-editorial")}>
          Política editorial
        </button>
        <button onClick={() => navigate("/privacidade")}>Privacidade</button>
        <button onClick={() => navigate("/ajuda")}>Ajuda</button>
      </div>
      <small>
        Plataforma de cursos livres. Não oferece diploma superior nem
        credenciamento MEC.
      </small>
    </footer>
  );
}

function Home({ catalog, courseById, lessonsFor, navigate }: Shared) {
  const highlighted = [courseById("d01"), courseById("mini-metodo")].filter(
    Boolean,
  ) as Course[];
  return (
    <>
      <section className="hero">
        <img
          className="hero-backdrop"
          src={`${import.meta.env.BASE_URL}images/fut-campus.png`}
          alt=""
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="eyebrow">ESTUDO TEOLÓGICO GRATUITO</div>
          <h1>
            Free University
            <br />
            <em>of Theology</em>
          </h1>
          <p>
            Uma biblioteca universitária contemporânea para explorar as
            Escrituras, a história e as tradições cristãs com clareza, fontes e
            respeito às divergências.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate("/cursos")}>
              Explorar cursos <span>→</span>
            </button>
            <button
              className="hero-link"
              onClick={() => navigate("/curso/d01")}
            >
              Comece por aqui <span>↗</span>
            </button>
          </div>
          <div className="hero-meta">
            <span>◈ Sem mensalidade</span>
            <span>◈ Sem anúncios obrigatórios</span>
            <span>◈ Texto como centro da aula</span>
          </div>
        </div>
        <div className="hero-seal" aria-label="Free University of Theology">
          <img
            src={`${import.meta.env.BASE_URL}images/fut-crest.png`}
            alt="Brasão da Free University of Theology"
          />
          <span>Faith · Scholarship · Service</span>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">ITINERÁRIO LIVRE</div>
            <h2>Seu percurso começa onde você está.</h2>
          </div>
          <button className="text-button" onClick={() => navigate("/trilhas")}>
            Ver todas as trilhas →
          </button>
        </div>
        <div className="track-grid">
          {[
            "Conhecendo a Bíblia",
            "Formação Teológica Básica",
            "Bíblia em Profundidade",
            "História e Pensamento Cristão",
            "Ministério e Ensino",
            "Idiomas Bíblicos e Pesquisa",
          ].map((track, index) => (
            <button
              className="track-card"
              onClick={() => navigate("/cursos")}
              key={track}
            >
              <span>0{index + 1}</span>
              <strong>{track}</strong>
              <small>Explorar percurso</small>
            </button>
          ))}
        </div>
      </section>
      <section className="section warm">
        <div className="section-heading">
          <div>
            <div className="eyebrow">EM ESTUDO</div>
            <h2>Conteúdo real, publicado com transparência.</h2>
          </div>
          <p>
            {
              catalog.courses.filter((item) => item.status === "development")
                .length
            }{" "}
            disciplinas aguardam desenvolvimento editorial.
          </p>
        </div>
        <div className="course-grid">
          {highlighted.map((course) => (
            <CourseCard
              course={course}
              lessons={lessonsFor(course.id)}
              navigate={navigate}
              key={course.id}
            />
          ))}
        </div>
      </section>
      <section className="principles">
        <div>
          <div className="eyebrow">COMPROMISSO EDITORIAL</div>
          <h2>Convicção e rigor não precisam ser adversários.</h2>
        </div>
        <div className="principles-copy">
          <p>
            O material distingue texto, comentário e interpretação; identifica
            fontes; sinaliza revisão pendente; e não transforma perspectivas
            teológicas em caricatura.
          </p>
          <img
            src={`${import.meta.env.BASE_URL}images/fut-library.png`}
            alt="Biblioteca universitária iluminada ao entardecer"
          />
        </div>
      </section>
    </>
  );
}
function CourseCard({
  course,
  lessons,
  navigate,
}: {
  course: Course;
  lessons: Lesson[];
  navigate: (path: string) => void;
}) {
  return (
    <article className="course-card">
      <div className="course-card-top">
        <Status status={course.status} />
        <span>{course.hours}h estimadas</span>
      </div>
      <div className="course-code">{course.code}</div>
      <h3>{course.title}</h3>
      <p>{course.summary}</p>
      <div className="course-card-bottom">
        <span>
          {lessons.length} aula{lessons.length === 1 ? "" : "s"} disponível
          {lessons.length === 1 ? "" : "is"}
        </span>
        <button onClick={() => navigate(`/curso/${course.id}`)}>
          Conhecer →
        </button>
      </div>
    </article>
  );
}
function CatalogPage({ catalog, lessonsFor, navigate }: Shared) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("todos");
  const courses = catalog.courses.filter(
    (course) =>
      !course.isPilot &&
      (period === "todos" || String(course.period) === period) &&
      `${course.title} ${course.summary} ${course.tracks.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="page">
      <div className="page-intro">
        <div className="eyebrow">CATÁLOGO ACADÊMICO INICIAL</div>
        <h1>Estude com liberdade, avance com profundidade.</h1>
        <p>
          O catálogo apresenta 6 períodos e 24 disciplinas. Cursos sem aulas
          revisadas são mostrados honestamente como em desenvolvimento.
        </p>
      </div>
      <div className="filters">
        <label>
          Buscar{" "}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Teologia, história, Bíblia..."
          />
        </label>
        <label>
          Período{" "}
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="todos">Todos</option>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <option key={item} value={item}>
                Período {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="catalog-note">
        {courses.length} resultados · nenhuma disciplina em desenvolvimento
        conta como conteúdo publicado.
      </div>
      <div className="course-grid">
        {courses.map((course) => (
          <CourseCard
            course={course}
            lessons={lessonsFor(course.id)}
            navigate={navigate}
            key={course.id}
          />
        ))}
      </div>
    </section>
  );
}
function CoursePage({
  catalog,
  courseById,
  lessonsFor,
  progress,
  results,
  account,
  recordAssessment,
  navigate,
  courseId,
}: Shared & { courseId: string }) {
  const course = courseById(courseId);
  if (!course) return <NotFound />;
  const lessons = lessonsFor(course.id);
  const modules = catalog.modules
    .filter((module) => module.courseId === course.id)
    .sort((a, b) => a.order - b.order);
  const complete = lessons.filter(
    (lesson) => progress[lesson.id]?.completed,
  ).length;
  return (
    <section className="course-page">
      <div className="breadcrumb">
        <button onClick={() => navigate("/cursos")}>Cursos</button> /{" "}
        {course.code}
      </div>
      <div className="course-hero">
        <div>
          <Status status={course.status} />
          <h1>{course.title}</h1>
          <p className="lead">{course.summary}</p>
          <div className="tags">
            {course.tracks.map((track) => (
              <span key={track}>{track}</span>
            ))}
            <span>{course.level}</span>
            <span>{course.hours}h estimadas</span>
          </div>
        </div>
        <div className="course-action-box">
          {lessons[0] ? (
            <>
              <strong>Comece gratuitamente</strong>
              <p>Não é necessário criar conta para abrir as aulas.</p>
              <button
                className="primary"
                onClick={() =>
                  navigate(`/estudar/${course.id}/${lessons[0].slug}`)
                }
              >
                Abrir primeira aula →
              </button>
            </>
          ) : (
            <>
              <strong>Em desenvolvimento</strong>
              <p>
                Este curso ainda não possui aulas publicadas. A estrutura
                curricular já está registrada, mas não será apresentada como
                acervo disponível.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="course-layout">
        <div>
          <h2>Objetivos de aprendizagem</h2>
          <ul className="check-list">
            {course.objectives.map((objective) => (
              <li key={objective}>✓ {objective}</li>
            ))}
          </ul>
          <h2>Programa do curso</h2>
          <div className="module-list">
            {modules.map((module) => {
              const items = lessons.filter(
                (lesson) => lesson.moduleId === module.id,
              );
              return (
                <details key={module.id} open={items.length > 0}>
                  <summary>
                    <span>Módulo {module.order}</span>
                    <strong>{module.title}</strong>
                    <small>
                      {items.length
                        ? `${items.length} aula(s) disponível(is)`
                        : "Programado - aguardando texto revisado"}
                    </small>
                  </summary>
                  {items.length > 0 && (
                    <div className="lesson-list">
                      {items.map((lesson) => (
                        <button
                          key={lesson.id}
                          onClick={() =>
                            navigate(`/estudar/${course.id}/${lesson.slug}`)
                          }
                        >
                          <span>
                            {progress[lesson.id]?.completed ? "✓" : "○"}
                          </span>
                          {lesson.title}
                          <small>{lesson.minutes} min</small>
                        </button>
                      ))}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
        <aside className="course-sidebar">
          <h3>Progresso neste dispositivo</h3>
          <div className="progress-bar">
            <i
              style={{
                width: `${lessons.length ? (complete / lessons.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p>
            {complete} de {lessons.length} aulas concluídas
          </p>
          {course.isPilot && (
            <div className="demo-box">
              <strong>Certificado de demonstração</strong>
              <p>
                {results[course.id]?.passed
                  ? "Avaliação aprovada. Conclua as aulas para liberar a emissão local."
                  : "Disponível após concluir as aulas e atingir 70% no questionário."}
              </p>
            </div>
          )}
          <h3>Transparência</h3>
          <p>
            Curso livre. Não equivale a graduação, pós-graduação ou título
            reconhecido pelo MEC.
          </p>
        </aside>
      </div>
      {course.isPilot && (
        <Quiz
          questions={catalog.questions}
          courseId={course.id}
          account={account}
          results={results}
          recordAssessment={recordAssessment}
        />
      )}
    </section>
  );
}
function Reader({
  courseById,
  lessonsFor,
  account,
  progress,
  notes,
  navigate,
  markComplete,
  setNotes,
  saveNote,
  fontScale,
  setFontScale,
  courseId,
  lessonSlug,
}: Shared & { courseId: string; lessonSlug: string }) {
  const course = courseById(courseId);
  const lessons = lessonsFor(courseId);
  const index = lessons.findIndex((lesson) => lesson.slug === lessonSlug);
  const lesson = lessons[index];
  const [videoLoaded, setVideoLoaded] = useState(false);
  if (!course || !lesson) return <NotFound />;
  const next = lessons[index + 1];
  const approved =
    lesson.video?.status === "approved" ? lesson.video : undefined;
  return (
    <section className="reader-shell">
      <aside className="reader-index">
        <button
          className="back-link"
          onClick={() => navigate(`/curso/${course.id}`)}
        >
          ← {course.title}
        </button>
        <strong>Conteúdo do curso</strong>
        {lessons.map((item) => (
          <button
            className={item.id === lesson.id ? "active" : ""}
            key={item.id}
            onClick={() => navigate(`/estudar/${course.id}/${item.slug}`)}
          >
            <span>{progress[item.id]?.completed ? "✓" : item.order}</span>
            {item.title}
          </button>
        ))}
      </aside>
      <article className="reader">
        <div className="reader-tools">
          <span>{lesson.minutes} min · leitura orientada</span>
          <div>
            <button
              onClick={() => setFontScale(Math.max(0.9, fontScale - 0.1))}
              aria-label="Diminuir fonte"
            >
              A−
            </button>
            <button
              onClick={() => setFontScale(Math.min(1.35, fontScale + 0.1))}
              aria-label="Aumentar fonte"
            >
              A+
            </button>
          </div>
        </div>
        {lesson.demoNote && (
          <div className="demo-banner">{lesson.demoNote}</div>
        )}
        <div className="eyebrow">
          {course.code} · AULA {lesson.order}
        </div>
        <h1>{lesson.title}</h1>
        <p className="reader-intro">{lesson.intro}</p>
        <section className="objectives">
          <strong>Ao final desta aula, você poderá:</strong>
          <ul>
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </section>
        <RichText blocks={lesson.body} fontScale={fontScale} />
        <section className="video-area">
          {approved ? (
            <>
              {videoLoaded ? (
                <iframe
                  title={approved.title}
                  src={`https://www.youtube-nocookie.com/embed/${approved.id}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="video-placeholder">
                  <span>▶</span>
                  <div>
                    <strong>{approved.title}</strong>
                    <small>{approved.channel} · Vídeo complementar</small>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setVideoLoaded(true)}
                  >
                    Reproduzir vídeo
                  </button>
                </div>
              )}
              <a href={approved.url} target="_blank" rel="noopener noreferrer">
                Assistir no YouTube ↗
              </a>
            </>
          ) : (
            <div className="video-empty">
              <strong>Sem vídeo incorporado nesta aula</strong>
              <p>
                O texto foi pensado para ser completo. Vídeos de terceiros só
                aparecem após triagem e aprovação editorial.
              </p>
            </div>
          )}
        </section>
        <section className="references">
          <h2>Referências e notas editoriais</h2>
          <ul>
            {lesson.references.map((reference) => (
              <li key={reference}>{reference}</li>
            ))}
          </ul>
        </section>
        <section className="notes">
          <h2>Suas anotações</h2>
          {account ? (
            <>
              <label htmlFor="note">
                Privadas e sincronizadas com sua conta ao sair do campo
              </label>
              <textarea
                id="note"
                value={notes[lesson.id] ?? ""}
                onChange={(event) =>
                  setNotes({ ...notes, [lesson.id]: event.target.value })
                }
                onBlur={(event) => saveNote(lesson.id, event.target.value)}
                placeholder="Escreva uma observação, dúvida ou referência para retomar depois."
              />
            </>
          ) : (
            <p>
              <button
                className="text-button"
                onClick={() => navigate("/entrar")}
              >
                Entre gratuitamente
              </button>{" "}
              para registrar anotações e acompanhar seu progresso.
            </p>
          )}
        </section>
        <div className="reader-next">
          <button
            className={
              progress[lesson.id]?.completed ? "completed-button" : "primary"
            }
            onClick={() => markComplete(lesson.id)}
          >
            {progress[lesson.id]?.completed
              ? "✓ Aula concluída"
              : "Marcar como concluída"}
          </button>
          {next && (
            <button
              className="outline"
              onClick={() => navigate(`/estudar/${course.id}/${next.slug}`)}
            >
              Próxima aula →
            </button>
          )}
        </div>
      </article>
    </section>
  );
}
function Login({
  authStatus,
  login,
  register,
}: {
  authStatus: AuthStatus;
  login: (email: string, password: string) => Promise<string | null>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result =
      mode === "login"
        ? await login(email, password)
        : await register(name, email, password);
    setBusy(false);
    if (result) setMessage(result);
  };
  return (
    <section className="auth-page">
      <div className="eyebrow">ACESSO GRATUITO</div>
      <h1>Seu campus, no seu ritmo.</h1>
      <p>
        Sua conta salva o avanço das aulas, anotações e avaliações. Professores
        autorizados recebem uma fila privada para acompanhar as tentativas.
      </p>
      {authStatus === "unconfigured" ? (
        <div className="auth-connection-notice">
          <strong>Conexão segura em preparação</strong>
          <p>
            O portal já está preparado para Supabase Auth. Falta apenas vincular
            as chaves públicas do projeto e aplicar a migração de segurança.
          </p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-mode" role="tablist" aria-label="Tipo de acesso">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              Criar conta
            </button>
          </div>
          {mode === "register" && (
            <label>
              Nome completo
              <input
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <label>
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              required
              type="password"
              minLength={8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || authStatus === "checking"}
          >
            {busy
              ? "Verificando acesso…"
              : mode === "login"
                ? "Entrar no campus"
                : "Criar conta gratuita"}
          </button>
          {message && <p className="form-message">{message}</p>}
        </form>
      )}
      <p className="fine-print">
        Autenticação por e-mail. Seu papel acadêmico é definido no banco e não
        pode ser alterado pelo navegador.
      </p>
    </section>
  );
}
function Campus({
  catalog,
  account,
  progress,
  results,
  notes,
  certificates,
  lessonsFor,
  navigate,
  fontScale,
  setFontScale,
  dark,
  setDark,
  syncMessage,
  logout,
}: Shared & { logout: () => void }) {
  if (!account)
    return (
      <section className="page">
        <h1>Seu campus</h1>
        <p>
          Entre gratuitamente para salvar seu progresso, anotações e avaliações
          em sua conta.
        </p>
        <button className="primary" onClick={() => navigate("/entrar")}>
          Entrar
        </button>
      </section>
    );
  const started = catalog.courses.filter((course) =>
    lessonsFor(course.id).some((lesson) => progress[lesson.id]?.completed),
  );
  return (
    <section className="page">
      <div className="page-intro compact">
        <div className="eyebrow">MEU CAMPUS</div>
        <h1>Olá, {account.name}.</h1>
        <p>
          Seus registros ficam vinculados à sua conta e acompanham seu acesso em
          diferentes dispositivos.
        </p>
        {syncMessage && <p className="sync-message">{syncMessage}</p>}
      </div>
      <div className="campus-grid">
        <section className="panel">
          <h2>Continue estudando</h2>
          {started.length ? (
            started.map((course) => {
              const lessons = lessonsFor(course.id);
              const done = lessons.filter(
                (lesson) => progress[lesson.id]?.completed,
              ).length;
              const next =
                lessons.find((lesson) => !progress[lesson.id]?.completed) ??
                lessons[0];
              return (
                <div className="continue-item" key={course.id}>
                  <div>
                    <strong>{course.title}</strong>
                    <small>
                      {done}/{lessons.length} aulas concluídas
                    </small>
                  </div>
                  <button
                    onClick={() =>
                      navigate(`/estudar/${course.id}/${next.slug}`)
                    }
                  >
                    Retomar →
                  </button>
                </div>
              );
            })
          ) : (
            <p>
              Nenhuma aula concluída ainda.{" "}
              <button
                className="text-button"
                onClick={() => navigate("/cursos")}
              >
                Explorar o catálogo
              </button>
              .
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Avaliações</h2>
          {Object.entries(results).length ? (
            Object.entries(results).map(([id, result]) => (
              <p key={id}>
                <strong>
                  {catalog.courses.find((course) => course.id === id)?.title}
                </strong>
                <br />
                {result.score}% ·{" "}
                {result.passed ? "Aprovado" : "Pode tentar novamente"}
                {result.feedback && (
                  <>
                    <br />
                    <span className="feedback-preview">
                      Devolutiva do professor: {result.feedback}
                    </span>
                  </>
                )}
              </p>
            ))
          ) : (
            <p>Você ainda não realizou avaliações.</p>
          )}
          <button
            className="text-button"
            onClick={() => navigate("/curso/mini-metodo")}
          >
            Abrir minicurso-piloto →
          </button>
        </section>
        <section className="panel">
          <h2>Notas privadas</h2>
          <p>
            {Object.values(notes).filter(Boolean).length
              ? `${Object.values(notes).filter(Boolean).length} anotação(ões) sincronizada(s).`
              : "Crie anotações dentro de uma aula para revisitá-las aqui."}
          </p>
        </section>
        <section className="panel">
          <h2>Certificados</h2>
          {certificates.length ? (
            certificates.map((certificate) => (
              <p key={certificate.token}>
                <button
                  className="text-button"
                  onClick={() =>
                    navigate(`/certificado/${certificate.courseId}`)
                  }
                >
                  Certificado de demonstração
                </button>
                <br />
                Emitido em{" "}
                {new Date(certificate.issuedAt).toLocaleDateString("pt-BR")}
              </p>
            ))
          ) : (
            <p>Nenhum certificado emitido.</p>
          )}
        </section>
      </div>
      <section className="settings panel">
        <h2>Preferências de leitura</h2>
        <label>
          Tamanho do texto{" "}
          <input
            type="range"
            min="0.9"
            max="1.35"
            step="0.05"
            value={fontScale}
            onChange={(event) => setFontScale(Number(event.target.value))}
          />
          <span>{Math.round(fontScale * 100)}%</span>
        </label>
        <label className="switch-row">
          Tema escuro{" "}
          <input
            type="checkbox"
            checked={dark}
            onChange={(event) => setDark(event.target.checked)}
          />
        </label>
        <button className="danger" onClick={logout}>
          Sair da conta
        </button>
      </section>
    </section>
  );
}
function TeacherReviews({
  account,
  attempts,
  catalog,
  navigate,
  publishFeedback,
}: {
  account: Account | null;
  attempts: TeacherAttempt[];
  catalog: Catalog;
  navigate: (to: string) => void;
  publishFeedback: (
    attemptId: string,
    feedback: string,
  ) => Promise<string | null>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (!account || (account.role !== "teacher" && account.role !== "admin"))
    return (
      <section className="page narrow">
        <div className="eyebrow">ÁREA ACADÊMICA</div>
        <h1>Avaliações para professores.</h1>
        <p>
          Esta área exige uma conta docente atribuída a pelo menos um curso.
        </p>
        <button className="primary" onClick={() => navigate("/entrar")}>
          Entrar em uma conta autorizada
        </button>
      </section>
    );
  const pending = attempts.filter((attempt) => !attempt.reviewed_at).length;
  const publish = async (attempt: TeacherAttempt) => {
    const feedback = (
      drafts[attempt.id] ??
      attempt.teacher_feedback ??
      ""
    ).trim();
    if (!feedback) {
      setMessage("Escreva uma devolutiva antes de publicar.");
      return;
    }
    setSaving(attempt.id);
    const error = await publishFeedback(attempt.id, feedback);
    setSaving(null);
    setMessage(error ?? "Devolutiva publicada para o estudante.");
  };
  return (
    <section className="page teacher-page">
      <div className="page-intro compact">
        <div className="eyebrow">ÁREA DOCENTE</div>
        <h1>Avaliações com contexto.</h1>
        <p>
          Você vê somente as tentativas dos cursos atribuídos ao seu perfil. A
          devolutiva fica disponível no campus do estudante.
        </p>
      </div>
      <div className="review-summary">
        <div>
          <span>Fila atual</span>
          <strong>{pending}</strong>
          <small>aguardando parecer</small>
        </div>
        <div>
          <span>Total visível</span>
          <strong>{attempts.length}</strong>
          <small>tentativas nos seus cursos</small>
        </div>
      </div>
      {message && <p className="sync-message">{message}</p>}
      {attempts.length ? (
        <div className="review-list">
          {attempts.map((attempt) => {
            const course = catalog.courses.find(
              (candidate) => candidate.id === attempt.course_id,
            );
            return (
              <article className="review-card" key={attempt.id}>
                <div className="review-card-head">
                  <div>
                    <span className="eyebrow">
                      {course?.code ?? attempt.course_id}
                    </span>
                    <h2>{attempt.student_name}</h2>
                    <p>{course?.title ?? "Curso não encontrado"}</p>
                  </div>
                  <div
                    className={attempt.passed ? "result-pass" : "result-retry"}
                  >
                    <strong>{attempt.score}%</strong>
                    <span>{attempt.passed ? "Aprovado" : "Revisar"}</span>
                  </div>
                </div>
                <p className="review-meta">
                  Enviado em{" "}
                  {new Date(attempt.submitted_at).toLocaleDateString("pt-BR")}
                  {attempt.reviewed_at &&
                    ` · Parecer publicado em ${new Date(attempt.reviewed_at).toLocaleDateString("pt-BR")}`}
                </p>
                <label>
                  Devolutiva acadêmica
                  <textarea
                    value={drafts[attempt.id] ?? attempt.teacher_feedback ?? ""}
                    onChange={(event) =>
                      setDrafts((value) => ({
                        ...value,
                        [attempt.id]: event.target.value,
                      }))
                    }
                    placeholder="Registre pontos fortes, referências para revisão e próximos passos."
                  />
                </label>
                <button
                  className="primary"
                  disabled={saving === attempt.id}
                  onClick={() => publish(attempt)}
                >
                  {saving === attempt.id
                    ? "Publicando…"
                    : "Publicar devolutiva"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel empty-review">
          <h2>Nenhuma tentativa disponível.</h2>
          <p>
            Quando um administrador atribuir cursos ao seu perfil, as avaliações
            dos estudantes aparecerão aqui com segurança.
          </p>
        </section>
      )}
    </section>
  );
}
function Quiz({
  questions,
  courseId,
  account,
  results,
  recordAssessment,
}: {
  questions: Catalog["questions"];
  courseId: string;
  account: Account | null;
  results: QuizResult;
  recordAssessment: (
    courseId: string,
    score: number,
    answers: Record<string, number>,
  ) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const items = questions.filter((question) => question.courseId === courseId);
  if (!items.length) return null;
  if (!account)
    return (
      <section className="quiz">
        <h2>Avaliação</h2>
        <p>Entre gratuitamente para registrar uma tentativa.</p>
      </section>
    );
  const submit = () => {
    const score = Math.round(
      (items.filter((question) => answers[question.id] === question.answer)
        .length /
        items.length) *
        100,
    );
    recordAssessment(courseId, score, answers);
    setSubmitted(true);
  };
  return (
    <section className="quiz">
      <div className="eyebrow">AVALIAÇÃO FORMATIVA</div>
      <h2>Verifique sua compreensão</h2>
      {items.map((question, index) => (
        <fieldset key={question.id}>
          <legend>
            {index + 1}. {question.prompt}
          </legend>
          {question.options.map((option, optionIndex) => (
            <label key={option}>
              <input
                type="radio"
                name={question.id}
                checked={answers[question.id] === optionIndex}
                onChange={() =>
                  setAnswers({ ...answers, [question.id]: optionIndex })
                }
              />{" "}
              {option}
            </label>
          ))}
          {submitted && (
            <p
              className={
                answers[question.id] === question.answer
                  ? "correct"
                  : "incorrect"
              }
            >
              {answers[question.id] === question.answer
                ? "✓ Correto. "
                : "Revise esta ideia. "}
              {question.explanation}
            </p>
          )}
        </fieldset>
      ))}
      <button
        className="primary"
        onClick={submit}
        disabled={Object.keys(answers).length !== items.length}
      >
        Enviar respostas
      </button>
      {submitted && (
        <p className="quiz-score">
          Resultado: <strong>{results[courseId]?.score}%</strong> ·{" "}
          {results[courseId]?.passed
            ? "Você alcançou o critério demonstrativo de 70%."
            : "Você pode revisar e tentar novamente."}
        </p>
      )}
    </section>
  );
}
function CertificatePage({
  courseById,
  lessonsFor,
  account,
  progress,
  results,
  certificates,
  setCertificates,
  navigate,
  courseId,
}: Shared & { courseId: string }) {
  const course = courseById(courseId);
  if (!course) return <NotFound />;
  const lessons = lessonsFor(courseId);
  const completed =
    lessons.length > 0 &&
    lessons.every((lesson) => progress[lesson.id]?.completed);
  const passed = results[courseId]?.passed;
  const issued = certificates.find(
    (certificate) => certificate.courseId === courseId,
  );
  const issue = () => {
    if (!account || !completed || !passed) return;
    const token = `demo-${crypto.randomUUID?.() ?? Date.now().toString(36)}`;
    setCertificates([
      ...certificates.filter(
        (certificate) => certificate.courseId !== courseId,
      ),
      {
        courseId,
        name: account.name,
        issuedAt: new Date().toISOString(),
        token,
      },
    ]);
  };
  if (!issued)
    return (
      <section className="page narrow">
        <div className="eyebrow">CERTIFICADO</div>
        <h1>Emissão de demonstração</h1>
        <p>
          Este fluxo simula o pedido de um certificado para curso livre
          totalmente publicado. No ambiente local, ele não possui verificação
          institucional nem valor documental.
        </p>
        <ul className="check-list">
          <li>
            {completed ? "✓" : "○"} Concluir todas as {lessons.length} aulas
          </li>
          <li>{passed ? "✓" : "○"} Alcançar ao menos 70% na avaliação</li>
          <li>{account ? "✓" : "○"} Estar em uma conta demonstrativa</li>
        </ul>
        <button
          className="primary"
          onClick={issue}
          disabled={!account || !completed || !passed}
        >
          Gerar certificado de demonstração
        </button>
        <button
          className="text-button"
          onClick={() => navigate(`/curso/${courseId}`)}
        >
          Voltar ao curso
        </button>
      </section>
    );
  return (
    <section className="certificate-wrap">
      <div className="certificate">
        <div className="watermark">DEMONSTRAÇÃO · SEM VALIDADE</div>
        <div className="certificate-mark">UL</div>
        <p>Certificado de conclusão</p>
        <h1>Curso livre - demonstração</h1>
        <span>Certificamos que</span>
        <h2>{issued.name}</h2>
        <span>concluiu o minicurso</span>
        <h3>{course.title}</h3>
        <p className="certificate-copy">
          com carga horária estimada de {course.hours} hora. Esta emissão é
          exclusivamente uma demonstração técnica; não equivale a diploma de
          graduação, pós-graduação ou título reconhecido pelo MEC.
        </p>
        <div className="certificate-bottom">
          <span>
            Emitido em {new Date(issued.issuedAt).toLocaleDateString("pt-BR")}
          </span>
          <span>Identificador: {issued.token}</span>
        </div>
      </div>
      <div className="certificate-actions">
        <button className="primary" onClick={() => window.print()}>
          Imprimir / salvar como PDF
        </button>
        <button
          className="outline"
          onClick={() => navigate(`/verificar/${issued.token}`)}
        >
          Abrir página de verificação
        </button>
      </div>
    </section>
  );
}
function Verification({
  certificates,
  token,
}: {
  certificates: Certificate[];
  token: string;
}) {
  const certificate = certificates.find((item) => item.token === token);
  return (
    <section className="page narrow">
      <div className="eyebrow">VERIFICAÇÃO</div>
      <h1>
        {certificate
          ? "Emissão de demonstração localizada"
          : "Certificado não localizado"}
      </h1>
      {certificate ? (
        <>
          <p>
            Registro local de {certificate.name}, emitido em{" "}
            {new Date(certificate.issuedAt).toLocaleDateString("pt-BR")}.
          </p>
          <div className="warning-box">
            <strong>Não verificável publicamente.</strong>
            <p>
              Este é um ambiente sem backend confiável e sem emissor
              institucional validado. A produção deve validar autenticação,
              progresso e avaliação no servidor antes de criar um registro
              público.
            </p>
          </div>
        </>
      ) : (
        <p>
          O identificador não existe neste navegador ou não foi emitido neste
          modo de demonstração.
        </p>
      )}
    </section>
  );
}
function Admin({ catalog, account, setCatalog, navigate }: Shared) {
  const [message, setMessage] = useState("");
  const [courseId, setCourseId] = useState("d01");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonBody, setLessonBody] = useState(
    "# Título da seção\nEscreva o texto da aula em parágrafos.\n! Use chamadas de atenção para limites e fontes.",
  );
  const [youtube, setYoutube] = useState("");
  const [approved, setApproved] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  if (account?.role !== "editor" && account?.role !== "admin")
    return (
      <section className="page narrow">
        <div className="eyebrow">ÁREA PROTEGIDA</div>
        <h1>Acesso restrito ao painel editorial.</h1>
        <p>
          Este painel exige um perfil editorial autorizado. A permissão também
          deve ser atribuída e validada no banco, fora do navegador.
        </p>
        <button className="primary" onClick={() => navigate("/entrar")}>
          Entrar em uma conta editorial
        </button>
      </section>
    );
  const selected =
    catalog.courses.find((course) => course.id === courseId) ??
    catalog.courses[0];
  const modules = catalog.modules.filter(
    (module) => module.courseId === selected.id,
  );
  const save = (next: Catalog, note: string) => {
    setCatalog(next);
    setMessage(note);
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ult-conteudo-exportado.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const addCourse = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const id = `${slugify(title)}-${Date.now().toString(36)}`;
    save(
      {
        ...catalog,
        courses: [
          ...catalog.courses,
          {
            id,
            code: `LOCAL-${catalog.courses.length + 1}`,
            title,
            subtitle: "Curso criado no painel local",
            summary: summary || "Resumo pendente de revisão editorial.",
            period: 0,
            tracks: ["Sem trilha definida"],
            level: "Iniciante",
            hours: 1,
            status: "draft",
            objectives: ["Definir objetivos de aprendizagem."],
            updatedAt: new Date().toISOString().slice(0, 10),
          },
        ],
      },
      "Curso salvo como rascunho.",
    );
    setCourseId(id);
    setTitle("");
    setSummary("");
  };
  const addModule = (event: FormEvent) => {
    event.preventDefault();
    if (!moduleTitle.trim()) return;
    save(
      {
        ...catalog,
        modules: [
          ...catalog.modules,
          {
            id: `${courseId}-m-${Date.now().toString(36)}`,
            courseId,
            title: moduleTitle,
            order: modules.length + 1,
            summary:
              "Módulo criado no painel. Complete a ementa antes de publicar.",
          },
        ],
      },
      "Módulo adicionado ao curso selecionado.",
    );
    setModuleTitle("");
  };
  const saveLesson = (event: FormEvent) => {
    event.preventDefault();
    if (!lessonTitle.trim() || !modules[0]) {
      setMessage("Crie um módulo e informe o título da aula antes de salvar.");
      return;
    }
    const parsed = youtube ? parseYouTubeVideo(youtube) : null;
    if (youtube && !parsed) {
      setMessage(
        "URL recusada: informe um ID ou URL HTTPS do YouTube permitida.",
      );
      return;
    }
    const id = editing ?? `${courseId}-l-${Date.now().toString(36)}`;
    const previous = catalog.lessons.find((item) => item.id === id);
    const lesson: Lesson = {
      id,
      courseId,
      moduleId: previous?.moduleId ?? modules[0].id,
      slug: slugify(lessonTitle),
      title: lessonTitle,
      intro: "Introdução editorial a revisar.",
      objectives: ["Definir objetivos observáveis no painel."],
      body: blocksFromText(lessonBody),
      references: ["Referências pendentes de revisão editorial."],
      minutes: 10,
      order:
        previous?.order ??
        catalog.lessons.filter((item) => item.courseId === courseId).length + 1,
      visibility: "draft",
      updatedAt: new Date().toISOString().slice(0, 10),
      video: parsed
        ? {
            id: parsed.id,
            url: parsed.canonicalUrl,
            title: "Vídeo complementar",
            channel: "Canal a confirmar",
            status: approved ? "approved" : "candidate",
          }
        : undefined,
      demoNote: "Rascunho editorial criado localmente.",
    };
    save(
      {
        ...catalog,
        lessons: [...catalog.lessons.filter((item) => item.id !== id), lesson],
      },
      previous
        ? "Aula atualizada como rascunho."
        : "Aula criada como rascunho.",
    );
    setLessonTitle("");
    setLessonBody("# Título da seção\nEscreva o texto da aula em parágrafos.");
    setYoutube("");
    setApproved(false);
    setEditing(null);
  };
  const togglePublish = (id: string) => {
    const lesson = catalog.lessons.find((item) => item.id === id);
    if (!lesson) return;
    save(
      {
        ...catalog,
        lessons: catalog.lessons.map((item) =>
          item.id === id
            ? {
                ...item,
                visibility:
                  item.visibility === "published" ? "draft" : "published",
              }
            : item,
        ),
        courses: catalog.courses.map((course) =>
          course.id === lesson.courseId
            ? { ...course, status: "published" }
            : course,
        ),
      },
      lesson.visibility === "published"
        ? "Aula despublicada."
        : "Aula publicada. Abra a prévia pública para conferir.",
    );
  };
  const load = (lesson: Lesson) => {
    setEditing(lesson.id);
    setCourseId(lesson.courseId);
    setLessonTitle(lesson.title);
    setLessonBody(
      lesson.body
        .map((block) =>
          block.type === "heading"
            ? `# ${block.text}`
            : block.type === "subheading"
              ? `## ${block.text}`
              : block.type === "callout"
                ? `! ${block.text}`
                : block.type === "list"
                  ? block.items?.map((item) => `- ${item}`).join("\n")
                  : block.text,
        )
        .join("\n"),
    );
    setYoutube(lesson.video?.url ?? "");
    setApproved(lesson.video?.status === "approved");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const importFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result)) as Partial<Catalog>;
        if (
          !Array.isArray(incoming.courses) ||
          !Array.isArray(incoming.modules) ||
          !Array.isArray(incoming.lessons)
        )
          throw new Error();
        const merge = <T extends { id: string }>(old: T[], added: T[]) => [
          ...old.filter((item) => !added.some((next) => next.id === item.id)),
          ...added,
        ];
        save(
          {
            courses: merge(catalog.courses, incoming.courses),
            modules: merge(catalog.modules, incoming.modules),
            lessons: merge(
              catalog.lessons,
              incoming.lessons.map((lesson) => ({
                ...lesson,
                visibility: "draft" as const,
              })),
            ),
            questions: merge(catalog.questions, incoming.questions ?? []),
          },
          "Importação validada: aulas carregadas como rascunho. Revise antes de publicar.",
        );
      } catch {
        setMessage(
          "Pacote inválido. Use a exportação JSON deste painel como referência.",
        );
      }
    };
    reader.readAsText(file);
  };
  return (
    <section className="admin">
      <div className="admin-header">
        <div>
          <div className="eyebrow">PAINEL EDITORIAL · DEMONSTRAÇÃO</div>
          <h1>Conteúdo sem tocar no código.</h1>
          <p>
            Este CMS local usa blocos estruturados, não HTML arbitrário. Dados
            entram como rascunho e são persistidos neste navegador.
          </p>
        </div>
        <div>
          <button className="outline" onClick={download}>
            Exportar JSON
          </button>
          <label className="upload">
            Importar JSON
            <input
              type="file"
              accept="application/json"
              onChange={importFile}
            />
          </label>
        </div>
      </div>
      {message && (
        <div className="admin-message" role="status">
          {message}
        </div>
      )}
      <div className="admin-grid">
        <section className="panel">
          <h2>Novo curso</h2>
          <form onSubmit={addCourse}>
            <label>
              Título
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>
            <label>
              Resumo
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
            <button className="primary">Salvar rascunho</button>
          </form>
        </section>
        <section className="panel">
          <h2>Estrutura do curso</h2>
          <label>
            Curso em edição
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              {catalog.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
            </select>
          </label>
          <p>
            {modules.length} módulo(s) ·{" "}
            {
              catalog.lessons.filter((lesson) => lesson.courseId === courseId)
                .length
            }{" "}
            aula(s)
          </p>
          <form onSubmit={addModule}>
            <label>
              Novo módulo
              <input
                value={moduleTitle}
                onChange={(event) => setModuleTitle(event.target.value)}
                placeholder="Título do módulo"
              />
            </label>
            <button className="outline">Adicionar módulo</button>
          </form>
        </section>
      </div>
      <section className="panel editor-panel">
        <div className="panel-heading">
          <div>
            <h2>{editing ? "Editar aula" : "Nova aula"}</h2>
            <p>
              Use # para seção, ## para subseção, - para item e ! para chamada
              de atenção.
            </p>
          </div>
          {editing && (
            <button className="quiet" onClick={() => setEditing(null)}>
              Cancelar edição
            </button>
          )}
        </div>
        <form onSubmit={saveLesson}>
          <div className="form-columns">
            <label>
              Título da aula
              <input
                value={lessonTitle}
                onChange={(event) => setLessonTitle(event.target.value)}
                required
              />
            </label>
            <label>
              Vídeo do YouTube (opcional)
              <input
                value={youtube}
                onChange={(event) => setYoutube(event.target.value)}
                placeholder="URL ou ID de vídeo"
              />
            </label>
          </div>
          <div className="editor-toolbar">
            <button
              type="button"
              onClick={() => setLessonBody(`${lessonBody}\n# Nova seção`)}
            >
              + Seção
            </button>
            <button
              type="button"
              onClick={() => setLessonBody(`${lessonBody}\n## Subseção`)}
            >
              + Subseção
            </button>
            <button
              type="button"
              onClick={() => setLessonBody(`${lessonBody}\n- Item de lista`)}
            >
              + Lista
            </button>
            <button
              type="button"
              onClick={() => setLessonBody(`${lessonBody}\n! Nota editorial`)}
            >
              + Aviso
            </button>
          </div>
          <label>
            Texto estruturado
            <textarea
              className="rich-input"
              value={lessonBody}
              onChange={(event) => setLessonBody(event.target.value)}
              required
            />
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />{" "}
            Confirmo que o vídeo foi revisado e está aprovado para incorporação
          </label>
          <button className="primary">
            {editing ? "Salvar nova versão" : "Salvar aula como rascunho"}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Revisão e publicação</h2>
        <p>
          Não há publicação automática por importação. Revise links, fontes e
          leitura em celular antes de liberar.
        </p>
        <div className="review-list">
          {catalog.lessons
            .filter((lesson) => lesson.courseId === courseId)
            .sort((a, b) => a.order - b.order)
            .map((lesson) => (
              <div key={lesson.id}>
                <div>
                  <strong>{lesson.title}</strong>
                  <small>
                    {lesson.visibility === "published"
                      ? "Publicado"
                      : "Rascunho"}{" "}
                    · atualizado em {lesson.updatedAt}
                  </small>
                </div>
                <span>
                  <button className="quiet" onClick={() => load(lesson)}>
                    Editar
                  </button>
                  <button
                    className={
                      lesson.visibility === "published" ? "danger" : "primary"
                    }
                    onClick={() => togglePublish(lesson.id)}
                  >
                    {lesson.visibility === "published"
                      ? "Despublicar"
                      : "Publicar"}
                  </button>
                  <button
                    className="outline"
                    onClick={() =>
                      navigate(`/estudar/${lesson.courseId}/${lesson.slug}`)
                    }
                  >
                    Prévia
                  </button>
                </span>
              </div>
            ))}
        </div>
      </section>
    </section>
  );
}
function Institutional({ route }: { route: string }) {
  const page = route.slice(1).replace(/-/g, " ") || "institucional";
  const labels: Record<string, [string, string]> = {
    trilhas: [
      "Trilhas de formação",
      "Seis rotas livres organizam o catálogo por interesse, sem barreiras pagas ou pré-requisitos obrigatórios.",
    ],
    biblioteca: [
      "Biblioteca",
      "O MVP prioriza referências, fichamentos e materiais originais. Não republica obras protegidas sem autorização.",
    ],
    metodologia: [
      "Metodologia",
      "A plataforma diferencia fonte, interpretação e aplicação; texto longo e leitura acessível são o centro da experiência.",
    ],
    "politica editorial": [
      "Política editorial",
      "Cada publicação deve identificar autoria, data, fontes e estágio de revisão. Divergências devem ser apresentadas com respeito e contexto.",
    ],
    privacidade: [
      "Privacidade",
      "O modo local não deve receber dados pessoais. A implantação deve definir base legal, retenção, exportação e exclusão conforme a LGPD.",
    ],
    ajuda: [
      "Ajuda",
      "Você pode estudar sem conta. Contas gratuitas servem para sincronizar progresso, notas, avaliações e eventual emissão de certificado após configuração segura.",
    ],
  };
  const content = labels[page] ?? [
    "Página não encontrada",
    "A rota informada não está disponível.",
  ];
  return (
    <section className="page narrow">
      <div className="eyebrow">INSTITUCIONAL</div>
      <h1>{content[0]}</h1>
      <p>{content[1]}</p>
    </section>
  );
}
function NotFound() {
  return (
    <section className="page narrow">
      <h1>Conteúdo não encontrado</h1>
      <p>Esta aula ainda não está publicada ou a URL está incorreta.</p>
    </section>
  );
}
export default App;
