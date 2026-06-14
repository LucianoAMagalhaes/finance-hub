import React, { useState, useMemo } from "react";
import {
  LayoutDashboard, Receipt, Wallet, Target, Settings, TrendingUp,
  Calculator, ChevronDown, ChevronRight, Plus, Search, X, Edit2, Trash2,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2,
  Fuel, ShoppingBag, Plane, Gift, Tag, Home, Coffee, Gamepad2,
  GraduationCap, PiggyBank, Briefcase, Banknote, TrendingDown,
  CreditCard, Smartphone, FileText, RefreshCw, Wallet2, PieChart,
  LineChart as LineChartIcon, Percent, Landmark, CalendarClock, BarChart3
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

/* =========================================================
   DESIGN TOKENS
   Paleta: "cofre" — grafite profundo + jade (crescimento) + âmbar (alerta)
   ========================================================= */
const COLORS = {
  bg: "#15191C",
  bgPanel: "#1C2125",
  bgCard: "#20262B",
  border: "#2E363C",
  borderLight: "#3A444C",
  text: "#EDEFF1",
  textMuted: "#8C97A0",
  textFaint: "#5E6B73",
  jade: "#4ADE80",
  jadeDim: "#2D5B42",
  amber: "#F5A623",
  amberDim: "#4D3B1A",
  red: "#F0654E",
  redDim: "#4A2A24",
  blue: "#5BA3F5",
};

// 6 potes
const POTES = {
  "Custos Fixos": { color: "#5BA3F5", icon: Home, pct: 55 },
  "Conforto": { color: "#F5A623", icon: Coffee, pct: 10 },
  "Prazeres": { color: "#F0654E", icon: Gamepad2, pct: 10 },
  "Metas": { color: "#4ADE80", icon: PiggyBank, pct: 10 },
  "Liberdade Financeira": { color: "#9D7BF0", icon: Briefcase, pct: 5 },
  "Conhecimento": { color: "#4FD1C5", icon: GraduationCap, pct: 10 },
};

const FONTES_RECEITA = ["Salário", "Freela", "Rendimentos", "Outras Receitas"];

const TIPOS_PAGAMENTO = [
  { nome: "Dinheiro", icon: Banknote },
  { nome: "Cartão de Débito", icon: CreditCard },
  { nome: "Cartão de Crédito", icon: CreditCard },
  { nome: "Pix", icon: Smartphone },
  { nome: "Transferência", icon: RefreshCw },
  { nome: "Boleto", icon: FileText },
  { nome: "Débito Automático", icon: RefreshCw },
];

const MARCADORES = [
  { nome: "combustível", icon: Fuel },
  { nome: "assinatura", icon: RefreshCw },
  { nome: "viagem", icon: Plane },
  { nome: "presente", icon: Gift },
  { nome: "mercado", icon: ShoppingBag },
];

const RENDA_MENSAL = 8500;

/* =========================================================
   MOCK DATA
   ========================================================= */
const CONTAS = [
  { id: "c1", nome: "Conta Corrente", saldo: 4230.50 },
  { id: "c2", nome: "Poupança", saldo: 12800.00 },
  { id: "c3", nome: "Carteira", saldo: 180.00 },
];

let TRANSACOES_SEED = [
  { id: "t1", data: "2026-06-01", descricao: "Salário Junho", valor: 8500, tipo: "receita", categoria: "Salário", subcategoria: "", marcador: "", conta: "Conta Corrente", pagamento: "Transferência" },
  { id: "t2", data: "2026-06-02", descricao: "Aluguel", valor: 2400, tipo: "despesa", categoria: "Custos Fixos", subcategoria: "Moradia", marcador: "", conta: "Conta Corrente", pagamento: "Débito Automático" },
  { id: "t3", data: "2026-06-03", descricao: "Supermercado Pão de Açúcar", valor: 540.30, tipo: "despesa", categoria: "Custos Fixos", subcategoria: "Alimentação", marcador: "mercado", conta: "Cartão de Crédito", pagamento: "Cartão de Crédito" },
  { id: "t4", data: "2026-06-04", descricao: "Abastecimento Shell", valor: 180.00, tipo: "despesa", categoria: "Conforto", subcategoria: "Transporte", marcador: "combustível", conta: "Conta Corrente", pagamento: "Pix" },
  { id: "t5", data: "2026-06-05", descricao: "Netflix", valor: 55.90, tipo: "despesa", categoria: "Prazeres", subcategoria: "Streaming", marcador: "assinatura", conta: "Cartão de Crédito", pagamento: "Cartão de Crédito" },
  { id: "t6", data: "2026-06-05", descricao: "Spotify", valor: 21.90, tipo: "despesa", categoria: "Prazeres", subcategoria: "Streaming", marcador: "assinatura", conta: "Cartão de Crédito", pagamento: "Cartão de Crédito" },
  { id: "t7", data: "2026-06-06", descricao: "Curso de Inglês", valor: 350.00, tipo: "despesa", categoria: "Conhecimento", subcategoria: "Idiomas", marcador: "", conta: "Conta Corrente", pagamento: "Boleto" },
  { id: "t8", data: "2026-06-07", descricao: "Freela Design Logo", valor: 1200, tipo: "receita", categoria: "Freela", subcategoria: "", marcador: "", conta: "Conta Corrente", pagamento: "Pix" },
  { id: "t9", data: "2026-06-08", descricao: "Restaurante - Jantar", valor: 145.00, tipo: "despesa", categoria: "Prazeres", subcategoria: "Lazer", marcador: "", conta: "Cartão de Débito", pagamento: "Cartão de Débito" },
  { id: "t10", data: "2026-06-08", descricao: "Aporte Reserva de Emergência", valor: 850, tipo: "despesa", categoria: "Metas", subcategoria: "Reserva", marcador: "", conta: "Poupança", pagamento: "Transferência" },
  { id: "t11", data: "2026-06-09", descricao: "Uber", valor: 38.50, tipo: "despesa", categoria: "Conforto", subcategoria: "Transporte", marcador: "", conta: "Conta Corrente", pagamento: "Pix" },
  { id: "t12", data: "2026-06-10", descricao: "Academia", valor: 119.90, tipo: "despesa", categoria: "Custos Fixos", subcategoria: "Saúde", marcador: "assinatura", conta: "Cartão de Crédito", pagamento: "Cartão de Crédito" },
  { id: "t13", data: "2026-06-11", descricao: "Rendimento CDB", valor: 64.20, tipo: "receita", categoria: "Rendimentos", subcategoria: "", marcador: "", conta: "Poupança", pagamento: "Transferência" },
  { id: "t14", data: "2026-06-12", descricao: "Presente Aniversário", valor: 200, tipo: "despesa", categoria: "Prazeres", subcategoria: "Lazer", marcador: "presente", conta: "Cartão de Débito", pagamento: "Cartão de Débito" },
  { id: "t15", data: "2026-06-12", descricao: "Conta de Luz", valor: 210.40, tipo: "despesa", categoria: "Custos Fixos", subcategoria: "Moradia", marcador: "", conta: "Conta Corrente", pagamento: "Débito Automático" },
  { id: "t16", data: "2026-06-13", descricao: "Investimento em ações", valor: 600, tipo: "despesa", categoria: "Liberdade Financeira", subcategoria: "Renda Variável", marcador: "", conta: "Conta Corrente", pagamento: "Transferência" },
  { id: "t17", data: "2026-06-13", descricao: "Livro - Educação Financeira", valor: 49.90, tipo: "despesa", categoria: "Conhecimento", subcategoria: "Livros", marcador: "", conta: "Cartão de Débito", pagamento: "Cartão de Débito" },
];

const HISTORICO_SALDO = [
  { mes: "Jan", saldo: 14200 },
  { mes: "Fev", saldo: 14950 },
  { mes: "Mar", saldo: 15600 },
  { mes: "Abr", saldo: 16100 },
  { mes: "Mai", saldo: 16800 },
  { mes: "Jun", saldo: 17210.50 },
];

const METAS_SEED = [
  { id: "m1", nome: "Reserva de Emergência", alvo: 25000, atual: 14800, prazo: "2026-12" },
  { id: "m2", nome: "Viagem Europa", alvo: 12000, atual: 3200, prazo: "2027-06" },
  { id: "m3", nome: "Entrada do Apartamento", alvo: 60000, atual: 18500, prazo: "2028-03" },
];

/* =========================================================
   HELPERS
   ========================================================= */
const fmt = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtCompact = (v) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
};

function getCategoriaMeta(t) {
  if (t.tipo === "despesa") return POTES[t.categoria] || { color: COLORS.textMuted, icon: Tag };
  return { color: COLORS.jade, icon: TrendingUp };
}

/* =========================================================
   SHARED UI PRIMITIVES
   ========================================================= */
function Pill({ children, color, dim, style }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 10px", borderRadius: 4, fontSize: 12,
        fontWeight: 600, letterSpacing: 0.2,
        background: dim || COLORS.bgPanel, color: color || COLORS.text,
        border: `1px solid ${COLORS.border}`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 20,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function Button({ children, variant = "primary", onClick, style, type = "button", ...rest }) {
  const base = {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 16px",
    borderRadius: 6,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all .15s ease",
    border: "1px solid transparent",
  };
  const variants = {
    primary: { background: COLORS.jade, color: "#0B1410", border: `1px solid ${COLORS.jade}` },
    ghost: { background: "transparent", color: COLORS.textMuted, border: `1px solid ${COLORS.border}` },
    danger: { background: "transparent", color: COLORS.red, border: `1px solid ${COLORS.redDim}` },
    subtle: { background: COLORS.bgPanel, color: COLORS.text, border: `1px solid ${COLORS.border}` },
  };
  return (
    <button type={type} onClick={onClick} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.bgPanel, border: `1px solid ${COLORS.borderLight}`,
          borderRadius: 10, width, maxWidth: "100%", maxHeight: "90vh",
          overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "18px 22px", borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: COLORS.bgCard,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: "9px 12px",
  color: COLORS.text,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer" };

/* =========================================================
   SIDEBAR (com submenus)
   ========================================================= */
const NAV_GROUPS = [
  {
    id: "orcamento",
    label: "Orçamento Doméstico",
    icon: Wallet2,
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "transacoes", label: "Transações", icon: Receipt },
      { id: "orcamentos", label: "Orçamentos", icon: Wallet },
      { id: "metas", label: "Metas Financeiras", icon: Target },
      { id: "categorias", label: "Categorias e Marcadores", icon: Tag },
    ],
  },
  {
    id: "investimentos",
    label: "Investimentos",
    icon: TrendingUp,
    items: [
      { id: "inv-visao-geral", label: "Visão Geral", icon: PieChart },
      { id: "inv-carteira", label: "Carteira", icon: Briefcase },
      { id: "inv-proventos", label: "Proventos", icon: Banknote },
      { id: "inv-rentabilidade", label: "Rentabilidade", icon: LineChartIcon },
    ],
  },
  {
    id: "calculadoras",
    label: "Calculadoras",
    icon: Calculator,
    items: [
      { id: "calc-juros-compostos", label: "Juros Compostos", icon: Percent },
      { id: "calc-independencia", label: "Independência Financeira", icon: Landmark },
      { id: "calc-aposentadoria", label: "Aposentadoria", icon: CalendarClock },
      { id: "calc-comparador", label: "Comparador de Investimentos", icon: BarChart3 },
    ],
  },
];

const STANDALONE_NAV = [
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

// localiza o grupo de um item por id
function findGroupOf(itemId) {
  for (const g of NAV_GROUPS) {
    if (g.items.some((i) => i.id === itemId)) return g.id;
  }
  return null;
}

function Sidebar({ active, setActive }) {
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    NAV_GROUPS.forEach((g) => { initial[g.id] = g.items.some((i) => i.id === active); });
    return initial;
  });

  const toggleGroup = (id) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectItem = (groupId, itemId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: true }));
    setActive(itemId);
  };

  return (
    <div style={{
      width: 250, background: COLORS.bgPanel, borderRight: `1px solid ${COLORS.border}`,
      display: "flex", flexDirection: "column", padding: "22px 14px", flexShrink: 0,
      height: "100vh", position: "sticky", top: 0, overflowY: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 10px 28px" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 7, background: COLORS.jade,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Wallet2 size={18} color="#0B1410" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.3 }}>hub<span style={{ color: COLORS.jade }}>finance</span></div>
          <div style={{ fontSize: 11, color: COLORS.textFaint }}>Protótipo v0.1</div>
        </div>
      </div>

      {NAV_GROUPS.map((g) => {
        const GroupIcon = g.icon;
        const isOpen = !!openGroups[g.id];
        const groupHasActive = g.items.some((i) => i.id === active);
        return (
          <div key={g.id} style={{ marginBottom: 6 }}>
            <div
              onClick={() => toggleGroup(g.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 6, cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                color: groupHasActive ? COLORS.text : COLORS.textMuted,
                letterSpacing: 0.3,
              }}
            >
              <GroupIcon size={16} />
              <span style={{ flex: 1 }}>{g.label}</span>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>

            {isOpen && (
              <div style={{ marginLeft: 12, borderLeft: `1px solid ${COLORS.border}`, paddingLeft: 8, marginBottom: 6 }}>
                {g.items.map((n) => {
                  const Icon = n.icon;
                  const isActive = active === n.id;
                  return (
                    <div
                      key={n.id}
                      onClick={() => selectItem(g.id, n.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                        fontSize: 13, fontWeight: isActive ? 700 : 500,
                        color: isActive ? COLORS.text : COLORS.textMuted,
                        background: isActive ? COLORS.bgCard : "transparent",
                        borderLeft: isActive ? `2px solid ${COLORS.jade}` : "2px solid transparent",
                        marginBottom: 1,
                      }}
                    >
                      <Icon size={14} />
                      {n.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ height: 1, background: COLORS.border, margin: "10px 0" }} />

      {STANDALONE_NAV.map((n) => {
        const Icon = n.icon;
        const isActive = active === n.id;
        return (
          <div
            key={n.id}
            onClick={() => setActive(n.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", borderRadius: 6, cursor: "pointer",
              fontSize: 14, fontWeight: isActive ? 700 : 500,
              color: isActive ? COLORS.text : COLORS.textMuted,
              background: isActive ? COLORS.bgCard : "transparent",
              borderLeft: isActive ? `2px solid ${COLORS.jade}` : "2px solid transparent",
              marginBottom: 2,
            }}
          >
            <Icon size={16} />
            {n.label}
          </div>
        );
      })}

      <div style={{ marginTop: "auto", padding: 12, background: COLORS.bgCard, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4 }}>Renda mensal configurada</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(RENDA_MENSAL)}</div>
      </div>
    </div>
  );
}

/* =========================================================
   TOP BAR with period filter
   ========================================================= */
function TopBar({ title, subtitle, period, setPeriod, showPeriod = true }) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [year, monthIdx] = [period.split("-")[0], parseInt(period.split("-")[1], 10) - 1];

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.3 }}>{title}</h1>
        {subtitle && <p style={{ margin: "4px 0 0", color: COLORS.textMuted, fontSize: 13 }}>{subtitle}</p>}
      </div>
      {showPeriod && (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <select
              value={monthIdx}
              onChange={(e) => setPeriod(`${year}-${String(parseInt(e.target.value, 10) + 1).padStart(2, "0")}`)}
              style={{ ...selectStyle, paddingRight: 32, fontWeight: 600 }}
            >
              {meses.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: "absolute", right: 10, top: 11, color: COLORS.textMuted, pointerEvents: "none" }} />
          </div>
          <div style={{ position: "relative" }}>
            <select
              value={year}
              onChange={(e) => setPeriod(`${e.target.value}-${period.split("-")[1]}`)}
              style={{ ...selectStyle, paddingRight: 32, fontWeight: 600 }}
            >
              {["2025", "2026", "2027"].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: "absolute", right: 10, top: 11, color: COLORS.textMuted, pointerEvents: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function DrillList({ titulo, transacoes, onClose, period }) {
  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        {titulo}
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer" }}>
          <X size={14} />
        </button>
      </div>
      {transacoes.length === 0 && <div style={{ fontSize: 13, color: COLORS.textFaint }}>Nenhuma transação encontrada.</div>}
      {transacoes.map((t) => {
        const meta = getCategoriaMeta(t);
        const Icon = meta.icon;
        return (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
            <Icon size={13} color={meta.color} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{t.descricao}</span>
              <span style={{ color: COLORS.textFaint }}> · {t.categoria}{t.subcategoria ? ` · ${t.subcategoria}` : ""} · {t.data.split("-").reverse().join("/")}</span>
            </div>
            <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(t.valor)}</div>
          </div>
        );
      })}
    </div>
  );
}

function Dashboard({ transacoes, period }) {
  const [drillPote, setDrillPote] = useState(null);
  const [drillMarcador, setDrillMarcador] = useState(null);
  const [drillPagamento, setDrillPagamento] = useState(null);

  const totalContas = CONTAS.reduce((s, c) => s + c.saldo, 0);

  const transMes = transacoes.filter((t) => t.data.startsWith(period));
  const receitas = transMes.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
  const despesas = transMes.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
  const saldoMes = receitas - despesas;

  const porPote = useMemo(() => {
    return Object.entries(POTES).map(([nome, meta]) => {
      const gasto = transMes
        .filter((t) => t.tipo === "despesa" && t.categoria === nome)
        .reduce((s, t) => s + t.valor, 0);
      const limite = RENDA_MENSAL * (meta.pct / 100);
      return { nome, gasto, limite, ...meta };
    });
  }, [transMes]);

  const porMarcador = useMemo(() => {
    const map = {};
    transMes.filter((t) => t.tipo === "despesa" && t.marcador).forEach((t) => {
      map[t.marcador] = (map[t.marcador] || 0) + t.valor;
    });
    return Object.entries(map).map(([marcador, valor]) => ({ marcador, valor })).sort((a, b) => b.valor - a.valor);
  }, [transMes]);

  const porPagamento = useMemo(() => {
    const map = {};
    transMes.filter((t) => t.tipo === "despesa").forEach((t) => {
      map[t.pagamento] = (map[t.pagamento] || 0) + t.valor;
    });
    return Object.entries(map).map(([pagamento, valor]) => ({ pagamento, valor })).sort((a, b) => b.valor - a.valor);
  }, [transMes]);

  const drillTransacoesPote = drillPote
    ? transMes.filter((t) => t.tipo === "despesa" && t.categoria === drillPote).sort((a,b)=>b.data.localeCompare(a.data))
    : [];

  const drillTransacoesMarcador = drillMarcador
    ? transMes.filter((t) => t.tipo === "despesa" && t.marcador === drillMarcador).sort((a,b)=>b.data.localeCompare(a.data))
    : [];

  const drillTransacoesPagamento = drillPagamento
    ? transMes.filter((t) => t.tipo === "despesa" && t.pagamento === drillPagamento).sort((a,b)=>b.data.localeCompare(a.data))
    : [];

  // Resumo por pote (substitui "Últimas transações")
  const resumoPotes = useMemo(() => {
    return porPote.map((p) => ({
      ...p,
      restante: p.limite - p.gasto,
      pctUtilizado: p.limite > 0 ? (p.gasto / p.limite) * 100 : 0,
      pctTotal: despesas > 0 ? (p.gasto / despesas) * 100 : 0,
    }));
  }, [porPote, despesas]);

  return (
    <div>
      {/* Card Total em conta */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card style={{ background: `linear-gradient(135deg, ${COLORS.bgCard} 0%, #1A2B22 100%)`, borderColor: COLORS.jadeDim }}>
          <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
            Total em conta
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: COLORS.jade, letterSpacing: -0.5 }}>{fmt(totalContas)}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
            {CONTAS.map((c) => (
              <div key={c.id}>
                <div style={{ fontSize: 11, color: COLORS.textFaint }}>{c.nome}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(c.saldo)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 10 }}>Saldo histórico — não filtrado pelo período</div>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.jade, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
            <ArrowUpRight size={14} /> Receitas
          </div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{fmt(receitas)}</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 6 }}>{monthLabel(period)}</div>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.red, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
            <ArrowDownRight size={14} /> Despesas
          </div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{fmt(despesas)}</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 6 }}>{monthLabel(period)}</div>
        </Card>

        <Card>
          <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
            Saldo do mês
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: saldoMes >= 0 ? COLORS.jade : COLORS.red }}>{fmt(saldoMes)}</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 6 }}>Receitas − Despesas</div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Evolução do saldo */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Evolução do saldo</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 12 }}>Últimos 6 meses, terminando em {monthLabel(period)}</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={HISTORICO_SALDO}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="mes" stroke={COLORS.textFaint} fontSize={12} tickLine={false} axisLine={{ stroke: COLORS.border }} />
              <YAxis stroke={COLORS.textFaint} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${fmtCompact(v/1000)}k`} />
              <Tooltip
                contentStyle={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.borderLight}`, borderRadius: 6, fontSize: 12 }}
                formatter={(v) => fmt(v)}
              />
              <Line type="monotone" dataKey="saldo" stroke={COLORS.jade} strokeWidth={2.5} dot={{ fill: COLORS.jade, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Resumo por pote (substitui "Últimas transações") */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 18px 10px" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Resumo por pote</div>
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 2 }}>{monthLabel(period)} · clique em "Orçamentos" para detalhes</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: COLORS.bgPanel, textAlign: "left" }}>
                {["Pote", "Gasto", "Disponível", "% Utilizado", "% Total"].map((h, i) => (
                  <th key={h} style={{
                    padding: "8px 10px", fontSize: 10, fontWeight: 700, color: COLORS.textFaint,
                    textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.border}`,
                    textAlign: i === 0 ? "left" : "right",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumoPotes.map((p) => {
                const Icon = p.icon;
                const alert = p.pctUtilizado >= 100 ? "over" : p.pctUtilizado >= 80 ? "warn" : "ok";
                const pctColor = alert === "over" ? COLORS.red : alert === "warn" ? COLORS.amber : COLORS.jade;
                return (
                  <tr key={p.nome} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon size={12} color={p.color} />
                        <span style={{ fontWeight: 600 }}>{p.nome}</span>
                      </div>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(p.gasto)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: p.restante >= 0 ? COLORS.textMuted : COLORS.red, whiteSpace: "nowrap" }}>{fmt(p.restante)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: pctColor }}>{p.pctUtilizado.toFixed(0)}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: COLORS.textMuted }}>{p.pctTotal.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: "8px 10px", fontWeight: 700, fontSize: 12 }}>Total</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{fmt(despesas)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: COLORS.textMuted, whiteSpace: "nowrap" }}>
                  {fmt(resumoPotes.reduce((s, p) => s + p.limite, 0) - despesas)}
                </td>
                <td colSpan={2} style={{ padding: "8px 10px" }} />
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>

      {/* Orçamento do mês por pote */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Orçamento do mês por pote</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint }}>Limite = % da renda ({fmt(RENDA_MENSAL)})</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
          {porPote.map((p) => {
            const Icon = p.icon;
            const ratio = p.limite > 0 ? p.gasto / p.limite : 0;
            const alert = ratio >= 1 ? "over" : ratio >= 0.8 ? "warn" : "ok";
            const barColor = alert === "over" ? COLORS.red : alert === "warn" ? COLORS.amber : p.color;
            return (
              <div
                key={p.nome}
                onClick={() => { setDrillPote(drillPote === p.nome ? null : p.nome); setDrillMarcador(null); setDrillPagamento(null); }}
                style={{
                  border: `1px solid ${drillPote === p.nome ? p.color : COLORS.border}`,
                  borderRadius: 8, padding: 14, cursor: "pointer",
                  background: drillPote === p.nome ? COLORS.bgPanel : "transparent",
                  transition: "all .15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={15} color={p.color} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{p.nome}</span>
                  </div>
                  {alert !== "ok" && <AlertTriangle size={14} color={alert === "over" ? COLORS.red : COLORS.amber} />}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{fmt(p.gasto)}</span>
                  <span style={{ color: COLORS.textFaint }}>de {fmt(p.limite)} ({p.pct}%)</span>
                </div>
                <div style={{ height: 6, background: COLORS.bgPanel, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(ratio * 100, 100)}%`, background: barColor, transition: "width .3s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        {drillPote && (
          <DrillList
            titulo={`Transações de "${drillPote}" em ${monthLabel(period)}`}
            transacoes={drillTransacoesPote}
            onClose={() => setDrillPote(null)}
            period={period}
          />
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Despesas por marcador</div>
          <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 12 }}>Clique numa barra para detalhar</div>
          {porMarcador.length === 0 && <div style={{ fontSize: 13, color: COLORS.textFaint }}>Nenhuma despesa marcada neste período.</div>}
          {porMarcador.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(porMarcador.length * 38, 80)}>
              <BarChart data={porMarcador} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="marcador" stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.borderLight}`, borderRadius: 6, fontSize: 12 }} formatter={(v) => fmt(v)} />
                <Bar
                  dataKey="valor" radius={[0, 4, 4, 0]} barSize={16} cursor="pointer"
                  onClick={(data) => { setDrillMarcador(drillMarcador === data.marcador ? null : data.marcador); setDrillPote(null); setDrillPagamento(null); }}
                >
                  {porMarcador.map((entry) => (
                    <Cell key={entry.marcador} fill={drillMarcador === entry.marcador ? COLORS.jade : COLORS.blue} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {drillMarcador && (
            <DrillList
              titulo={`Transações com marcador "${drillMarcador}" em ${monthLabel(period)}`}
              transacoes={drillTransacoesMarcador}
              onClose={() => setDrillMarcador(null)}
              period={period}
            />
          )}
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Despesas por forma de pagamento</div>
          <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 12 }}>Clique numa barra para detalhar</div>
          <ResponsiveContainer width="100%" height={Math.max(porPagamento.length * 38, 80)}>
            <BarChart data={porPagamento} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="pagamento" stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} width={120} />
              <Tooltip contentStyle={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.borderLight}`, borderRadius: 6, fontSize: 12 }} formatter={(v) => fmt(v)} />
              <Bar
                dataKey="valor" radius={[0, 4, 4, 0]} barSize={16} cursor="pointer"
                onClick={(data) => { setDrillPagamento(drillPagamento === data.pagamento ? null : data.pagamento); setDrillPote(null); setDrillMarcador(null); }}
              >
                {porPagamento.map((entry) => (
                  <Cell key={entry.pagamento} fill={drillPagamento === entry.pagamento ? COLORS.jade : COLORS.amber} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {drillPagamento && (
            <DrillList
              titulo={`Transações pagas com "${drillPagamento}" em ${monthLabel(period)}`}
              transacoes={drillTransacoesPagamento}
              onClose={() => setDrillPagamento(null)}
              period={period}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

/* =========================================================
   TRANSAÇÕES
   ========================================================= */
function TransactionForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    descricao: "", valor: "", data: new Date().toISOString().slice(0, 10),
    tipo: "despesa", categoria: "Custos Fixos", subcategoria: "", marcador: "",
    conta: CONTAS[0].nome, pagamento: "Pix",
  });

  const categoriasDisponiveis = form.tipo === "despesa" ? Object.keys(POTES) : FONTES_RECEITA;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.descricao || !form.valor || !form.data) return;
    onSave({ ...form, valor: parseFloat(form.valor), id: form.id || `t${Date.now()}` });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["despesa", "receita"].map((tp) => (
          <button
            key={tp} type="button"
            onClick={() => { set("tipo", tp); set("categoria", tp === "despesa" ? "Custos Fixos" : "Salário"); }}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer",
              border: `1px solid ${form.tipo === tp ? (tp === "despesa" ? COLORS.red : COLORS.jade) : COLORS.border}`,
              background: form.tipo === tp ? (tp === "despesa" ? COLORS.redDim : COLORS.jadeDim) : "transparent",
              color: form.tipo === tp ? COLORS.text : COLORS.textMuted,
            }}
          >
            {tp === "despesa" ? "Despesa" : "Receita"}
          </button>
        ))}
      </div>

      <Field label="Descrição *">
        <input style={inputStyle} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex: Supermercado, Salário..." required />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Valor (R$) *">
          <input style={inputStyle} type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" required />
        </Field>
        <Field label="Data *">
          <input style={inputStyle} type="date" value={form.data} onChange={(e) => set("data", e.target.value)} required />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label={`Categoria (pote) *`}>
          <select style={selectStyle} value={form.categoria} onChange={(e) => set("categoria", e.target.value)}>
            {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Subcategoria">
          <input style={inputStyle} value={form.subcategoria} onChange={(e) => set("subcategoria", e.target.value)} placeholder="Ex: Transporte" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Conta *">
          <select style={selectStyle} value={form.conta} onChange={(e) => set("conta", e.target.value)}>
            {CONTAS.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </Field>
        <Field label="Tipo de pagamento *">
          <select style={selectStyle} value={form.pagamento} onChange={(e) => set("pagamento", e.target.value)}>
            {TIPOS_PAGAMENTO.map((p) => <option key={p.nome} value={p.nome}>{p.nome}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Marcador / Tag (opcional, apenas 1)">
        <select style={selectStyle} value={form.marcador} onChange={(e) => set("marcador", e.target.value)}>
          <option value="">Nenhum</option>
          {MARCADORES.map((m) => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
        </select>
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit">{form.id ? "Salvar alterações" : "Criar transação"}</Button>
      </div>
    </form>
  );
}

function Transacoes({ transacoes, setTransacoes }) {
  const [filtros, setFiltros] = useState({ tipo: "", categoria: "", pagamento: "", busca: "" });
  const [modal, setModal] = useState(null); // null | {edit?: transaction}
  const [confirmDelete, setConfirmDelete] = useState(null);

  const todasCategorias = [...Object.keys(POTES), ...FONTES_RECEITA];

  const filtradas = useMemo(() => {
    return transacoes
      .filter((t) => !filtros.tipo || t.tipo === filtros.tipo)
      .filter((t) => !filtros.categoria || t.categoria === filtros.categoria)
      .filter((t) => !filtros.pagamento || t.pagamento === filtros.pagamento)
      .filter((t) => !filtros.busca || t.descricao.toLowerCase().includes(filtros.busca.toLowerCase()))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [transacoes, filtros]);

  const save = (t) => {
    setTransacoes((prev) => {
      const exists = prev.find((p) => p.id === t.id);
      if (exists) return prev.map((p) => (p.id === t.id ? t : p));
      return [t, ...prev];
    });
    setModal(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Transações</h1>
          <p style={{ margin: "4px 0 0", color: COLORS.textMuted, fontSize: 13 }}>{filtradas.length} transações encontradas</p>
        </div>
        <Button variant="primary" onClick={() => setModal({})}>
          <Plus size={15} /> Nova transação
        </Button>
      </div>

      {/* Filtros */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: COLORS.textFaint }} />
            <input
              style={{ ...inputStyle, paddingLeft: 32 }}
              placeholder="Buscar por descrição..."
              value={filtros.busca}
              onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
            />
          </div>
          <select style={selectStyle} value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}>
            <option value="">Todos os tipos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <select style={selectStyle} value={filtros.categoria} onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}>
            <option value="">Todas as categorias</option>
            {todasCategorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={selectStyle} value={filtros.pagamento} onChange={(e) => setFiltros((f) => ({ ...f, pagamento: e.target.value }))}>
            <option value="">Todos os pagamentos</option>
            {TIPOS_PAGAMENTO.map((p) => <option key={p.nome} value={p.nome}>{p.nome}</option>)}
          </select>
        </div>
      </Card>

      {/* Tabela */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: COLORS.bgPanel, textAlign: "left" }}>
              {["Data", "Descrição", "Categoria", "Marcador", "Conta", "Pagamento", "Valor", ""].map((h) => (
                <th key={h} style={{ padding: "11px 16px", fontSize: 11, fontWeight: 700, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((t) => {
              const meta = getCategoriaMeta(t);
              const Icon = meta.icon;
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "12px 16px", color: COLORS.textMuted, whiteSpace: "nowrap" }}>{t.data.split("-").reverse().join("/")}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{t.descricao}{t.subcategoria && <span style={{ color: COLORS.textFaint, fontWeight: 400 }}> · {t.subcategoria}</span>}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <Pill color={meta.color}><Icon size={12} />{t.categoria}</Pill>
                  </td>
                  <td style={{ padding: "12px 16px", color: COLORS.textMuted }}>{t.marcador ? <Pill>{t.marcador}</Pill> : "—"}</td>
                  <td style={{ padding: "12px 16px", color: COLORS.textMuted }}>{t.conta}</td>
                  <td style={{ padding: "12px 16px", color: COLORS.textMuted }}>{t.pagamento}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: t.tipo === "receita" ? COLORS.jade : COLORS.text, whiteSpace: "nowrap" }}>
                    {t.tipo === "receita" ? "+" : "−"} {fmt(t.valor)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setModal({ edit: t })} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", padding: 4 }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setConfirmDelete(t)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: COLORS.textFaint }}>Nenhuma transação encontrada com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {modal && (
        <Modal title={modal.edit ? "Editar transação" : "Nova transação"} onClose={() => setModal(null)}>
          <TransactionForm initial={modal.edit} onSave={save} onClose={() => setModal(null)} />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Excluir transação" onClose={() => setConfirmDelete(null)} width={400}>
          <p style={{ fontSize: 14, color: COLORS.textMuted, margin: "0 0 18px" }}>
            Tem certeza que deseja excluir <strong style={{ color: COLORS.text }}>{confirmDelete.descricao}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { setTransacoes((prev) => prev.filter((p) => p.id !== confirmDelete.id)); setConfirmDelete(null); }}>
              <Trash2 size={14} /> Excluir
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================
   ORÇAMENTOS
   ========================================================= */
function Orcamentos({ transacoes, period }) {
  const transMes = transacoes.filter((t) => t.data.startsWith(period) && t.tipo === "despesa");

  const orcamentos = Object.entries(POTES).map(([nome, meta]) => {
    const limite = RENDA_MENSAL * (meta.pct / 100);
    const gasto = transMes.filter((t) => t.categoria === nome).reduce((s, t) => s + t.valor, 0);
    return { nome, limite, gasto, ...meta };
  });

  const totalLimite = orcamentos.reduce((s, o) => s + o.limite, 0);
  const totalGasto = orcamentos.reduce((s, o) => s + o.gasto, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Orçamentos</h1>
          <p style={{ margin: "4px 0 0", color: COLORS.textMuted, fontSize: 13 }}>Método dos 6 potes · {monthLabel(period)}</p>
        </div>
        <Button variant="primary"><Plus size={15} /> Novo orçamento</Button>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Visão geral do mês</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{fmt(totalGasto)} <span style={{ fontSize: 14, color: COLORS.textFaint, fontWeight: 500 }}>de {fmt(totalLimite)}</span></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: COLORS.textFaint }}>Disponível</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: totalLimite - totalGasto >= 0 ? COLORS.jade : COLORS.red }}>{fmt(totalLimite - totalGasto)}</div>
          </div>
        </div>
        <div style={{ height: 8, background: COLORS.bgPanel, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min((totalGasto / totalLimite) * 100, 100)}%`, background: totalGasto > totalLimite ? COLORS.red : COLORS.jade }} />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {orcamentos.map((o) => {
          const Icon = o.icon;
          const ratio = o.gasto / o.limite;
          const pct = Math.min(ratio * 100, 100);
          const status = ratio >= 1 ? "100%+ — Limite atingido" : ratio >= 0.8 ? `${Math.round(ratio*100)}% — Próximo do limite` : `${Math.round(ratio*100)}% utilizado`;
          const statusColor = ratio >= 1 ? COLORS.red : ratio >= 0.8 ? COLORS.amber : COLORS.jade;

          return (
            <Card key={o.nome}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: COLORS.bgPanel, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={18} color={o.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{o.nome}</div>
                    <div style={{ fontSize: 12, color: COLORS.textFaint }}>{o.pct}% da renda · mensal</div>
                  </div>
                </div>
                {ratio >= 0.8 && (
                  <Pill color={statusColor} dim={ratio >= 1 ? COLORS.redDim : COLORS.amberDim}>
                    {ratio >= 1 ? <AlertTriangle size={12} /> : <AlertTriangle size={12} />} {ratio >= 1 ? "100%" : "80%"}
                  </Pill>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>{fmt(o.gasto)}</span>
                <span style={{ fontSize: 13, color: COLORS.textFaint }}>limite {fmt(o.limite)}</span>
              </div>

              <div style={{ height: 8, background: COLORS.bgPanel, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: statusColor, transition: "width .3s ease" }} />
              </div>

              <div style={{ fontSize: 12, color: statusColor, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                {ratio < 0.8 && <CheckCircle2 size={12} />}
                {status}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   METAS
   ========================================================= */
function GoalForm({ onSave, onClose }) {
  const [form, setForm] = useState({ nome: "", alvo: "", atual: "", prazo: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.nome || !form.alvo || !form.prazo) return;
    onSave({ ...form, id: `m${Date.now()}`, alvo: parseFloat(form.alvo), atual: parseFloat(form.atual || 0) });
  };
  return (
    <form onSubmit={submit}>
      <Field label="Nome da meta *">
        <input style={inputStyle} value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Viagem para a praia" required />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Valor alvo (R$) *">
          <input style={inputStyle} type="number" step="0.01" value={form.alvo} onChange={(e) => set("alvo", e.target.value)} placeholder="0,00" required />
        </Field>
        <Field label="Valor atual (R$)">
          <input style={inputStyle} type="number" step="0.01" value={form.atual} onChange={(e) => set("atual", e.target.value)} placeholder="0,00" />
        </Field>
      </div>
      <Field label="Prazo *">
        <input style={inputStyle} type="month" value={form.prazo} onChange={(e) => set("prazo", e.target.value)} required />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit">Criar meta</Button>
      </div>
    </form>
  );
}

function Metas() {
  const [metas, setMetas] = useState(METAS_SEED);
  const [modal, setModal] = useState(false);

  const monthsUntil = (prazo) => {
    const [y, m] = prazo.split("-").map(Number);
    const now = new Date(2026, 5); // Junho 2026
    return Math.max((y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()), 1);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Metas Financeiras</h1>
          <p style={{ margin: "4px 0 0", color: COLORS.textMuted, fontSize: 13 }}>{metas.length} metas em andamento</p>
        </div>
        <Button variant="primary" onClick={() => setModal(true)}><Plus size={15} /> Nova meta</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {metas.map((m) => {
          const pct = Math.min((m.atual / m.alvo) * 100, 100);
          const restante = Math.max(m.alvo - m.atual, 0);
          const meses = monthsUntil(m.prazo);
          const aporteMensal = restante / meses;
          return (
            <Card key={m.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: COLORS.jadeDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Target size={18} color={COLORS.jade} />
                </div>
                <Pill>{monthLabel(m.prazo)}</Pill>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{m.nome}</div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{fmt(m.atual)}</span>
                <span style={{ fontSize: 12, color: COLORS.textFaint }}>de {fmt(m.alvo)}</span>
              </div>
              <div style={{ height: 8, background: COLORS.bgPanel, borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: COLORS.jade }} />
              </div>
              <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>{pct.toFixed(0)}% concluído</div>

              <div style={{ background: COLORS.bgPanel, borderRadius: 6, padding: 12, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>Aporte mensal sugerido</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.jade }}>{fmt(aporteMensal)}</div>
                <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 2 }}>para atingir a meta em {meses} {meses === 1 ? "mês" : "meses"}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {modal && (
        <Modal title="Nova meta financeira" onClose={() => setModal(false)}>
          <GoalForm onSave={(m) => { setMetas((prev) => [...prev, m]); setModal(false); }} onClose={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

/* =========================================================
   CATEGORIAS E MARCADORES (submenu de Orçamento Doméstico)
   ========================================================= */
function Categorias() {
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Categorias e Marcadores</h1>
      <p style={{ margin: "4px 0 24px", color: COLORS.textMuted, fontSize: 13 }}>Personalize os 6 potes, fontes de receita, marcadores e contas</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Categorias de Despesa (6 potes)</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>Cada pote tem um percentual sugerido da renda</div>
          {Object.entries(POTES).map(([nome, meta]) => {
            const Icon = meta.icon;
            return (
              <div key={nome} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: COLORS.bgPanel, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} color={meta.color} />
                </div>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{nome}</div>
                <Pill color={meta.color}>{meta.pct}% da renda</Pill>
                <button style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer" }}><Edit2 size={13} /></button>
              </div>
            );
          })}
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Fontes de Receita</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>Categorias usadas para classificar receitas</div>
          {FONTES_RECEITA.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: COLORS.jadeDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={15} color={COLORS.jade} />
              </div>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{f}</div>
              <button style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer" }}><Edit2 size={13} /></button>
            </div>
          ))}
          <Button variant="ghost" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}><Plus size={14} /> Adicionar fonte</Button>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Marcadores / Tags</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>Reutilizáveis em receitas e despesas — máx. 1 por transação</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MARCADORES.map((m) => {
              const Icon = m.icon;
              return <Pill key={m.nome}><Icon size={12} />{m.nome}</Pill>;
            })}
            <Pill style={{ cursor: "pointer", color: COLORS.jade }}><Plus size={12} /> Novo marcador</Pill>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Contas</div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>Suas contas e carteiras</div>
          {CONTAS.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: COLORS.bgPanel, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wallet size={15} color={COLORS.textMuted} />
              </div>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(c.saldo)}</div>
            </div>
          ))}
          <Button variant="ghost" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}><Plus size={14} /> Adicionar conta</Button>
        </Card>
      </div>
    </div>
  );
}

/* =========================================================
   CONFIGURAÇÕES GERAIS
   ========================================================= */
function Configuracoes() {
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Configurações</h1>
      <p style={{ margin: "4px 0 24px", color: COLORS.textMuted, fontSize: 13 }}>Preferências gerais do hub</p>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Renda mensal</div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 12 }}>Usada como base para os limites dos 6 potes</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input style={{ ...inputStyle, maxWidth: 220 }} defaultValue={fmt(RENDA_MENSAL)} />
          <Button variant="subtle">Salvar</Button>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Categorias e marcadores</div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 12 }}>Gerencie os 6 potes, fontes de receita, marcadores e contas</div>
        <Button variant="ghost"><Tag size={14} /> Abrir Categorias e Marcadores</Button>
      </Card>

      <Card style={{ textAlign: "center", padding: "40px 30px", border: `1px dashed ${COLORS.borderLight}` }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: COLORS.bgPanel, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Settings size={22} color={COLORS.textFaint} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Mais preferências em breve</div>
        <div style={{ fontSize: 13, color: COLORS.textFaint, maxWidth: 360, margin: "0 auto" }}>
          Tema, moeda, exportação de dados e notificações serão adicionados aqui.
        </div>
      </Card>
    </div>
  );
}

/* =========================================================
   PLACEHOLDER MODULES (Investimentos, Calculadoras)
   ========================================================= */
function PlaceholderModule({ title, description, icon: Icon }) {
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{title}</h1>
      <p style={{ margin: "4px 0 24px", color: COLORS.textMuted, fontSize: 13 }}>{description}</p>
      <Card style={{ textAlign: "center", padding: "60px 30px", border: `1px dashed ${COLORS.borderLight}` }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: COLORS.bgPanel, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon size={26} color={COLORS.textFaint} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Módulo em construção</div>
        <div style={{ fontSize: 13, color: COLORS.textFaint, maxWidth: 380, margin: "0 auto" }}>
          Esta seção do hub ainda não foi detalhada no escopo. Quando as funcionalidades forem definidas, este espaço receberá o protótipo correspondente.
        </div>
      </Card>
    </div>
  );
}

/* =========================================================
   APP ROOT
   ========================================================= */
const PLACEHOLDER_META = {
  "inv-visao-geral": { title: "Visão Geral", description: "Resumo da carteira, evolução do patrimônio e alocação por classe de ativo", icon: PieChart },
  "inv-carteira": { title: "Carteira", description: "Lista de ativos, quantidades, preço médio e valor atual", icon: Briefcase },
  "inv-proventos": { title: "Proventos", description: "Histórico de dividendos, juros e rendimentos recebidos", icon: Banknote },
  "inv-rentabilidade": { title: "Rentabilidade", description: "Comparativo de performance da carteira vs. benchmarks", icon: LineChartIcon },
  "calc-juros-compostos": { title: "Juros Compostos", description: "Simule o crescimento de um investimento ao longo do tempo", icon: Percent },
  "calc-independencia": { title: "Independência Financeira", description: "Calcule o patrimônio necessário para viver de renda", icon: Landmark },
  "calc-aposentadoria": { title: "Aposentadoria", description: "Projete aportes mensais necessários para a aposentadoria", icon: CalendarClock },
  "calc-comparador": { title: "Comparador de Investimentos", description: "Compare rentabilidade líquida entre diferentes aplicações", icon: BarChart3 },
};

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [transacoes, setTransacoes] = useState(TRANSACOES_SEED);
  const [period, setPeriod] = useState("2026-06");

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <Sidebar active={active} setActive={setActive} />
      <div style={{ flex: 1, padding: "28px 32px", maxWidth: 1320 }}>
        {active === "dashboard" && (
          <>
            <TopBar title="Dashboard" subtitle="Visão geral das suas finanças" period={period} setPeriod={setPeriod} />
            <Dashboard transacoes={transacoes} period={period} />
          </>
        )}
        {active === "transacoes" && <Transacoes transacoes={transacoes} setTransacoes={setTransacoes} />}
        {active === "orcamentos" && <Orcamentos transacoes={transacoes} period={period} />}
        {active === "metas" && <Metas />}
        {active === "categorias" && <Categorias />}
        {active === "configuracoes" && <Configuracoes />}
        {PLACEHOLDER_META[active] && (
          <PlaceholderModule
            title={PLACEHOLDER_META[active].title}
            description={PLACEHOLDER_META[active].description}
            icon={PLACEHOLDER_META[active].icon}
          />
        )}
      </div>
    </div>
  );
}
