import {
  AlignCenter,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignVerticalSpaceAround,
  AlignJustify,
  ArrowDownToLine,
  ArrowUpToLine,
  BringToFront,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  SendToBack,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import {
  ANIMATIONS,
  DECORATIONS,
  PATTERNS,
  SHADOWS,
  CARD_STYLES,
  TEXT_TOKENS,
  THEMES,
  THEME_COLOR_KEYS,
  TRANSITIONS,
  backgroundSuggestions,
  fontStack,
  themeById,
  widgetDefinition,
  widgetToDemo,
} from "../../lib/presentations.js";
import { BRANDS, BUILTIN_LOGOS, brandLogoFor } from "../../lib/brand.js";
import { WIDGET_CATALOG } from "../../lib/dashboardWidgets.js";
import { ColorField, Field, FontSelect, NumberInput, Row, Section, Segmented, Select, Slider, TextArea, TextInput, Toggle } from "./controls.jsx";
import { Decoration, SHAPES, brandSrc, slideBackground } from "./SlideView.jsx";
import { DemoInspector } from "./DemoInspector.jsx";
import { DEMO_TITLES } from "../../lib/slideDemo.js";

const KIND_LABEL = {
  text: "Texto",
  kpi: "Número",
  widget: "Gráfico do B.I.",
  chart: "Gráfico próprio",
  table: "Tabela livre",
  meta: "Meta",
  demo: "Demonstrativo sob medida",
  image: "Imagem",
  shape: "Forma",
  icon: "Ícone",
};

export function blockName(block) {
  if (block.kind === "text") return (block.text || "Texto").split("\n")[0].slice(0, 28) || "Texto";
  if (block.kind === "kpi" || block.kind === "widget") return widgetDefinition(block.widgetId)?.label || KIND_LABEL[block.kind];
  if (block.kind === "image" && block.brand) return "Logo";
  if (block.kind === "shape") return SHAPES.find((shape) => shape.id === block.shape)?.label || "Forma";
  if (block.kind === "chart" && block.title) return block.title;
  if (block.kind === "meta") return block.label || "Meta";
  if (block.kind === "demo") return block.title || DEMO_TITLES[block.source] || "Demonstrativo";
  return KIND_LABEL[block.kind] || "Bloco";
}

function IconButton({ icon: Icon, title, onClick, danger = false, active = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 flex-1 items-center justify-center rounded-md border transition-colors ${
        danger ? "border-line text-danger-600 hover:bg-danger-50" : active ? "border-accent-400 bg-accent-50 text-accent-600" : "border-line text-ink-600 hover:bg-surface-muted hover:text-ink-900"
      }`}
    >
      <Icon size={15} strokeWidth={1.8} />
    </button>
  );
}

const WEIGHTS = [
  { value: "300", label: "Fina" },
  { value: "400", label: "Normal" },
  { value: "500", label: "Média" },
  { value: "600", label: "Seminegrito" },
  { value: "700", label: "Negrito" },
  { value: "800", label: "Extra" },
];

const ALIGN_OPTIONS = [
  { value: "left", icon: AlignLeft, title: "Esquerda" },
  { value: "center", icon: AlignCenter, title: "Centro" },
  { value: "right", icon: AlignRight, title: "Direita" },
  { value: "justify", icon: AlignJustify, title: "Justificado" },
];

const VALIGN_OPTIONS = [
  { value: "top", icon: ArrowUpToLine, title: "Em cima" },
  { value: "middle", icon: AlignCenterVertical, title: "No meio" },
  { value: "bottom", icon: ArrowDownToLine, title: "Embaixo" },
];

function TokenInsert({ onInsert, ctx }) {
  const kpis = WIDGET_CATALOG.filter((item) => item.type === "kpi");
  return (
    <Select
      value=""
      onChange={(value) => value && onInsert(value)}
      options={[
        { value: "", label: "+ Inserir dado automático…" },
        ...TEXT_TOKENS.map((item) => ({ value: item.token, label: item.label })),
        ...(ctx ? kpis.map((item) => ({ value: `{kpi:${item.id}}`, label: `Valor: ${item.label}` })) : []),
      ]}
    />
  );
}

function TypographySection({ block, theme, set }) {
  return (
    <Section title="Texto">
      <Field label="Fonte">
        <FontSelect value={block.font} onChange={(value) => set({ font: value })} theme={theme} />
      </Field>
      <Row>
        <Field label="Tamanho">
          <NumberInput value={block.size} min={6} max={400} onChange={(value) => set({ size: value }, "size")} suffix="px" />
        </Field>
        <Field label="Peso">
          <Select value={String(block.weight)} onChange={(value) => set({ weight: Number(value) })} options={WEIGHTS} />
        </Field>
      </Row>
      <Field label="Cor">
        <ColorField value={block.color} onChange={(value) => set({ color: value })} theme={theme} />
      </Field>
      <Field label="Alinhamento">
        <Segmented value={block.align} onChange={(value) => set({ align: value })} options={ALIGN_OPTIONS} />
      </Field>
      <Field label="Posição vertical">
        <Segmented value={block.valign} onChange={(value) => set({ valign: value })} options={VALIGN_OPTIONS} />
      </Field>
      <Segmented
        value=""
        onChange={(value) => set({ [value]: !block[value] })}
        options={[
          { value: "italic", label: <span className={block.italic ? "font-bold italic text-accent-600" : "italic"}>Itálico</span> },
          { value: "underline", label: <span className={block.underline ? "font-bold text-accent-600 underline" : "underline"}>Sublinhado</span> },
          { value: "uppercase", label: <span className={block.uppercase ? "font-bold text-accent-600" : ""}>MAIÚSC.</span> },
        ]}
      />
      <Field label="Espaço entre linhas">
        <Slider value={block.lineHeight} min={0.8} max={2.4} step={0.05} onChange={(value) => set({ lineHeight: value }, "lineHeight")} />
      </Field>
      <Field label="Espaço entre letras">
        <Slider value={block.letterSpacing} min={-3} max={20} step={0.5} onChange={(value) => set({ letterSpacing: value }, "letterSpacing")} suffix="px" />
      </Field>
      <Field label="Lista">
        <Segmented
          value={block.list}
          onChange={(value) => set({ list: value })}
          options={[
            { value: "none", label: "—" },
            { value: "bullet", label: "●" },
            { value: "number", label: "1." },
            { value: "check", label: "✓" },
            { value: "arrow", label: "→" },
            { value: "dash", label: "–" },
          ]}
        />
      </Field>
      {block.list !== "none" && (
        <Field label="Cor dos marcadores">
          <ColorField value={block.listColor} onChange={(value) => set({ listColor: value })} theme={theme} />
        </Field>
      )}
      <Field label="Texto em degradê (até esta cor)">
        <ColorField value={block.gradient || ""} onChange={(value) => set({ gradient: value })} theme={theme} allowNone />
      </Field>
      {block.gradient && (
        <Field label="Direção do degradê">
          <Slider value={block.gradientAngle ?? 90} min={0} max={360} step={5} onChange={(value) => set({ gradientAngle: value }, "gradientAngle")} suffix="°" />
        </Field>
      )}
    </Section>
  );
}

function AppearanceSection({ block, theme, setStyle, set }) {
  const s = block.style || {};
  const isCard = ["kpi", "widget", "chart", "table", "meta"].includes(block.kind);
  const isLine = block.kind === "shape" && block.shape === "line";
  return (
    <Section title="Aparência">
      {isCard && s.fill === "@surface" && !s.fill2 && (
        <Field label="Estilo do cartão">
          <Select
            value={s.cardStyle ?? "@theme"}
            onChange={(value) => setStyle({ cardStyle: value === "@theme" ? null : value })}
            options={[{ value: "@theme", label: `Do tema (${CARD_STYLES.find((item) => item.id === (theme.cardStyle || "solid"))?.label})` }, ...CARD_STYLES.map((item) => ({ value: item.id, label: item.label }))]}
          />
        </Field>
      )}
      <Field label={isLine ? "Cor da linha" : "Preenchimento"}>
        <ColorField value={s.fill} onChange={(value) => setStyle({ fill: value })} theme={theme} allowNone />
      </Field>
      {s.fill && !isLine && (
        <>
          <Field label="Degradê até (opcional)">
            <ColorField value={s.fill2} onChange={(value) => setStyle({ fill2: value })} theme={theme} allowNone />
          </Field>
          {s.fill2 && (
            <Field label="Direção do degradê">
              <Slider value={s.gradAngle ?? 135} min={0} max={360} step={5} onChange={(value) => setStyle({ gradAngle: value }, "gradAngle")} suffix="°" />
            </Field>
          )}
          <Field label="Transparência do preenchimento">
            <Slider value={s.fillOpacity ?? 100} min={0} max={100} onChange={(value) => setStyle({ fillOpacity: value }, "fillOpacity")} suffix="%" />
          </Field>
        </>
      )}
      <Row>
        <Field label={isLine ? "Espessura" : "Borda"}>
          <NumberInput value={s.borderWidth || 0} min={0} max={60} onChange={(value) => setStyle({ borderWidth: value, ...(value > 0 && !s.border && !isLine ? { border: "@accent" } : {}) }, "borderWidth")} suffix="px" />
        </Field>
        <Field label="Estilo">
          <Select
            value={s.borderStyle || "solid"}
            onChange={(value) => setStyle({ borderStyle: value })}
            options={[
              { value: "solid", label: "Contínua" },
              { value: "dashed", label: "Tracejada" },
              { value: "dotted", label: "Pontilhada" },
            ]}
          />
        </Field>
      </Row>
      {!isLine && (s.borderWidth || 0) > 0 && (
        <Field label="Cor da borda">
          <ColorField value={s.border} onChange={(value) => setStyle({ border: value })} theme={theme} />
        </Field>
      )}
      {block.kind !== "shape" || block.shape === "rect" ? (
        <Field label={isCard && s.radius == null ? `Cantos arredondados (do tema: ${theme.radius}px)` : "Cantos arredondados"}>
          <Slider value={s.radius ?? theme.radius} min={0} max={200} onChange={(value) => setStyle({ radius: value }, "radius")} suffix="px" />
        </Field>
      ) : null}
      <Row>
        <Field label="Sombra">
          <Select
            value={s.shadow ?? "@theme"}
            onChange={(value) => setStyle({ shadow: value === "@theme" ? null : value })}
            options={[...(isCard ? [{ value: "@theme", label: "Do tema" }] : []), ...SHADOWS.map((item) => ({ value: item.id, label: item.label }))]}
          />
        </Field>
        <Field label="Margem interna">
          <NumberInput value={s.padding || 0} min={0} max={200} onChange={(value) => setStyle({ padding: value }, "padding")} suffix="px" />
        </Field>
      </Row>
      <Field label="Transparência do bloco">
        <Slider value={block.opacity ?? 100} min={5} max={100} onChange={(value) => set({ opacity: value }, "opacity")} suffix="%" />
      </Field>
    </Section>
  );
}

function PositionSection({ block, set, actions }) {
  return (
    <Section title="Posição e tamanho">
      <Row>
        <NumberInput label="X" value={Math.round(block.x)} onChange={(value) => set({ x: value }, "x")} />
        <NumberInput label="Y" value={Math.round(block.y)} onChange={(value) => set({ y: value }, "y")} />
        <NumberInput label="L" value={Math.round(block.w)} min={4} onChange={(value) => set({ w: value }, "w")} />
        <NumberInput label="A" value={Math.round(block.h)} min={4} onChange={(value) => set({ h: value }, "h")} />
      </Row>
      <Field label="Girar">
        <Slider value={block.rotation || 0} min={-180} max={180} onChange={(value) => set({ rotation: value }, "rotation")} suffix="°" />
      </Field>
      <Field label="Alinhar no slide">
        <div className="grid grid-cols-6 gap-1">
          <IconButton icon={AlignStartVertical} title="Encostar à esquerda" onClick={() => actions.alignToSlide("left")} />
          <IconButton icon={AlignCenterVertical} title="Centralizar na horizontal" onClick={() => actions.alignToSlide("hcenter")} />
          <IconButton icon={AlignEndVertical} title="Encostar à direita" onClick={() => actions.alignToSlide("right")} />
          <IconButton icon={AlignStartHorizontal} title="Encostar em cima" onClick={() => actions.alignToSlide("top")} />
          <IconButton icon={AlignCenterHorizontal} title="Centralizar na vertical" onClick={() => actions.alignToSlide("vcenter")} />
          <IconButton icon={AlignEndHorizontal} title="Encostar embaixo" onClick={() => actions.alignToSlide("bottom")} />
        </div>
      </Field>
    </Section>
  );
}

function BlockActions({ block, actions, set }) {
  return (
    <div className="grid grid-cols-7 gap-1 border-b border-line px-4 py-3">
      <IconButton icon={Copy} title="Duplicar (Ctrl+D)" onClick={actions.duplicate} />
      <IconButton icon={BringToFront} title="Trazer para a frente" onClick={actions.front} />
      <IconButton icon={ChevronUp} title="Subir uma camada" onClick={actions.forward} />
      <IconButton icon={ChevronDown} title="Descer uma camada" onClick={actions.backward} />
      <IconButton icon={SendToBack} title="Mandar para trás" onClick={actions.back} />
      <IconButton icon={block.locked ? Lock : Unlock} title={block.locked ? "Destravar" : "Travar posição"} active={block.locked} onClick={() => set({ locked: !block.locked })} />
      <IconButton icon={Trash2} title="Apagar (Delete)" danger onClick={actions.remove} />
    </div>
  );
}

function ChartColorsField({ colors, theme, onChange, count = 5 }) {
  const list = colors || ["@accent", "@accent2", "@accent3", "@positive", "@negative"];
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <ColorField
          key={i}
          compact
          value={list[i]}
          theme={theme}
          label={`Cor ${i + 1}`}
          onChange={(value) => {
            const next = [...list];
            next[i] = value;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function ImageContentSection({ block, set, onUploadImage, brandLogos, canSaveLogo, onSaveLogo }) {
  const logos = [...BUILTIN_LOGOS.map((logo) => ({ ...logo, builtin: true })), ...(brandLogos || [])];
  return (
    <Section title="Imagem">
      <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-500 text-[12.5px] font-medium text-white hover:bg-accent-600">
        <Upload size={14} />
        {block.src || block.brand ? "Trocar imagem" : "Escolher imagem do computador"}
        <input type="file" accept="image/*" className="hidden" onChange={(event) => onUploadImage(event.target.files?.[0])} />
      </label>
      <p className="-mt-1 text-[11px] text-ink-400">Também dá pra arrastar uma imagem pro slide ou colar (Ctrl+V).</p>
      <Field label="Logos">
        <div className="grid grid-cols-2 gap-1.5">
          {BRANDS.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() => set({ brand: brand.id, src: "", w: Math.round(block.h * brand.ratio) })}
              className={`flex h-12 items-center justify-center rounded-md border px-2 ${block.brand === brand.id ? "border-accent-500 ring-1 ring-accent-500" : "border-line hover:border-accent-400"}`}
              title={`${brand.name} — muda sozinha entre clara e escura conforme o fundo`}
              style={{ background: "linear-gradient(90deg, #161616 50%, #ffffff 50%)" }}
            >
              <img src={brandLogoFor(brand.id, true).src} alt="" className="h-5" />
            </button>
          ))}
          {logos.map((logo) => (
            <button
              key={logo.id}
              type="button"
              title={logo.name}
              onClick={() => (logo.builtin ? set({ brand: logo.id, src: "" }) : set({ brand: "", src: logo.src }))}
              className={`flex h-12 items-center justify-center rounded-md border px-2 ${(logo.builtin ? block.brand === logo.id : block.src === logo.src) ? "border-accent-500 ring-1 ring-accent-500" : "border-line hover:border-accent-400"}`}
              style={{ background: logo.id.endsWith("-claro") ? "#161616" : "repeating-conic-gradient(#e4e4e7 0 25%, #ffffff 0 50%) 0 0/10px 10px" }}
            >
              <img src={logo.src} alt="" className="max-h-8 max-w-full object-contain" />
            </button>
          ))}
        </div>
      </Field>
      {canSaveLogo && block.src && !logos.some((logo) => logo.src === block.src) && (
        <button type="button" onClick={onSaveLogo} className="h-8 rounded-md border border-line text-[12px] text-ink-700 hover:border-accent-400 hover:text-accent-600">
          Guardar como logo do escritório
        </button>
      )}
      {(block.src || block.brand) && (
        <>
          <Field label="Encaixe">
            <Segmented
              value={block.fit}
              onChange={(value) => set({ fit: value })}
              options={[
                { value: "cover", label: "Preencher" },
                { value: "contain", label: "Caber inteira" },
                { value: "fill", label: "Esticar" },
              ]}
            />
          </Field>
          {block.fit === "cover" && (
            <Row>
              <Field label="Foco horizontal">
                <Slider value={block.focusX ?? 50} onChange={(value) => set({ focusX: value }, "focusX")} suffix="%" />
              </Field>
              <Field label="Foco vertical">
                <Slider value={block.focusY ?? 50} onChange={(value) => set({ focusY: value }, "focusY")} suffix="%" />
              </Field>
            </Row>
          )}
          <Field label="Preto e branco">
            <Slider value={block.grayscale || 0} onChange={(value) => set({ grayscale: value }, "grayscale")} suffix="%" />
          </Field>
          <Field label="Brilho">
            <Slider value={block.brightness ?? 100} min={20} max={180} onChange={(value) => set({ brightness: value }, "brightness")} suffix="%" />
          </Field>
          <Toggle label="Espelhar" checked={Boolean(block.flipX)} onChange={(value) => set({ flipX: value })} />
        </>
      )}
    </Section>
  );
}

export function BlockInspector({ block, deck, ctx, set, setStyle, actions, openPicker, onUploadImage, brandLogos, canSaveLogo, onSaveLogo }) {
  const theme = deck.theme;
  const definition = block.widgetId ? widgetDefinition(block.widgetId) : null;
  const isTableWidget = definition?.type === "table" || definition?.type === "list";
  return (
    <div>
      <div className="px-4 pb-1 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">{KIND_LABEL[block.kind]}</p>
        <p className="truncate text-[14px] font-medium text-ink-900">{blockName(block)}</p>
      </div>
      <BlockActions block={block} actions={actions} set={set} />

      {block.kind === "text" && (
        <>
          <Section title="Conteúdo">
            <TextArea value={block.text} rows={5} onChange={(value) => set({ text: value }, "text")} />
            <p className="-mt-1 text-[11px] leading-snug text-ink-400">Dica: **negrito**, *itálico*. Clique duas vezes no slide pra escrever direto nele.</p>
            <TokenInsert ctx={ctx} onInsert={(token) => set({ text: `${block.text}${block.text ? " " : ""}${token}` })} />
          </Section>
          <TypographySection block={block} theme={theme} set={set} />
        </>
      )}

      {block.kind === "kpi" && (
        <>
          <Section title="Número">
            <button type="button" onClick={() => openPicker("kpi")} className="h-9 rounded-lg border border-line text-[12.5px] font-medium text-ink-800 hover:border-accent-400 hover:text-accent-600">
              Trocar: {definition?.label || "escolher"}
            </button>
            <Field label="Título (vazio = nome do indicador)">
              <TextInput value={block.label} placeholder={definition?.label} onChange={(value) => set({ label: value }, "label")} />
            </Field>
            <Toggle label="Mostrar título" checked={block.showLabel} onChange={(value) => set({ showLabel: value })} />
            <Toggle label="Mostrar ícone" checked={block.showIcon} onChange={(value) => set({ showIcon: value })} />
            <Toggle label="Mostrar a fórmula embaixo" checked={block.showCaption} onChange={(value) => set({ showCaption: value })} />
            <Field label="Formato do número">
              <Segmented
                value={block.numberStyle || "full"}
                onChange={(value) => set({ numberStyle: value })}
                options={[
                  { value: "compact", label: "R$ 1,88 mi" },
                  { value: "full", label: "R$ 1.881.222,53" },
                ]}
              />
            </Field>
            <Toggle label="Minigráfico mês a mês" checked={Boolean(block.trend)} onChange={(value) => set({ trend: value })} />
            <Toggle label="Variação do último mês (▲/▼)" checked={Boolean(block.delta)} onChange={(value) => set({ delta: value })} />
            <Field label="Alinhamento">
              <Segmented value={block.align} onChange={(value) => set({ align: value })} options={ALIGN_OPTIONS.slice(0, 3)} />
            </Field>
          </Section>
          <Section title="Texto">
            <Field label="Fonte do valor">
              <FontSelect value={block.font} onChange={(value) => set({ font: value })} theme={theme} />
            </Field>
            <Field label="Tamanho do valor">
              <Slider value={block.valueSize} min={14} max={160} onChange={(value) => set({ valueSize: value }, "valueSize")} suffix="px" />
            </Field>
            <Field label="Cor do valor">
              <Select
                value={block.valueColor === "auto" || block.valueColor === "sign" ? block.valueColor : "custom"}
                onChange={(value) => set({ valueColor: value === "custom" ? "@accent" : value })}
                options={[
                  { value: "auto", label: "Automática (vermelho se negativo)" },
                  { value: "sign", label: "Verde se positivo, vermelho se negativo" },
                  { value: "custom", label: "Escolher cor" },
                ]}
              />
            </Field>
            {block.valueColor !== "auto" && block.valueColor !== "sign" && <ColorField value={block.valueColor} onChange={(value) => set({ valueColor: value })} theme={theme} />}
            <Field label="Fonte do título">
              <FontSelect value={block.labelFont || "@body"} onChange={(value) => set({ labelFont: value })} theme={theme} />
            </Field>
            <Row>
              <Field label="Tamanho do título">
                <NumberInput value={block.labelSize} min={8} max={80} onChange={(value) => set({ labelSize: value }, "labelSize")} suffix="px" />
              </Field>
              <Field label="Cor do título">
                <ColorField compact value={block.labelColor} onChange={(value) => set({ labelColor: value })} theme={theme} />
              </Field>
            </Row>
            {block.showIcon && (
              <Field label="Cor do ícone">
                <ColorField value={block.iconColor} onChange={(value) => set({ iconColor: value })} theme={theme} />
              </Field>
            )}
          </Section>
        </>
      )}

      {block.kind === "widget" && definition?.type === "table" && (
        <div className="mx-4 mt-3 rounded-lg border border-accent-300 bg-accent-50 p-3">
          <p className="text-[12.5px] font-semibold text-ink-900">Quer escolher o que aparece?</p>
          <p className="mt-1 text-[11.5px] leading-snug text-ink-600">Esta é a tabela fixa do B.I. Transformada em <strong>Demonstrativo sob medida</strong>, dá pra abrir linhas até as contas, destacar, esconder e explorar na apresentação — no mesmo lugar e tamanho.</p>
          <button type="button" onClick={() => set(widgetToDemo(block))} className="mt-2 h-8 w-full rounded-md bg-accent-500 text-[12.5px] font-medium text-white hover:bg-accent-600">
            Transformar em Demonstrativo sob medida
          </button>
        </div>
      )}

      {block.kind === "widget" && (
        <Section title="Gráfico / tabela">
          <button type="button" onClick={() => openPicker("widget")} className="h-9 rounded-lg border border-line text-[12.5px] font-medium text-ink-800 hover:border-accent-400 hover:text-accent-600">
            Trocar: {definition?.label || "escolher"}
          </button>
          <Toggle label="Mostrar o título do gráfico" checked={block.showTitle} onChange={(value) => set({ showTitle: value })} />
          <Field label="Tamanho do conteúdo (letras e números)">
            <Slider value={Math.round((block.zoom || 1) * 100)} min={50} max={260} step={5} onChange={(value) => set({ zoom: value / 100 }, "zoom")} suffix="%" />
          </Field>
          {definition?.type === "table" && (
            <Field label="Colunas">
              <Segmented
                value={block.tableColumns}
                onChange={(value) => set({ tableColumns: value })}
                options={[
                  { value: "total", label: "Total do período" },
                  { value: "meses", label: "Mês a mês" },
                ]}
              />
            </Field>
          )}
          {isTableWidget && (
            <Field label="Linhas (0 = quantas couberem)">
              <NumberInput value={block.maxRows || 0} min={0} max={80} onChange={(value) => set({ maxRows: value }, "maxRows")} />
            </Field>
          )}
          <Toggle label="Cores próprias no gráfico" checked={Boolean(block.chartColors)} onChange={(value) => set({ chartColors: value ? ["@accent", "@accent2", "@accent3", "@positive", "@negative"] : null })} />
          {block.chartColors && (
            <>
              <ChartColorsField colors={block.chartColors} theme={theme} onChange={(value) => set({ chartColors: value })} />
              <p className="-mt-1 text-[11px] text-ink-400">Principal, secundária, terceira, positivo e negativo.</p>
            </>
          )}
        </Section>
      )}

      {block.kind === "demo" && <DemoInspector block={block} deck={deck} ctx={ctx} set={set} />}

      {block.kind === "chart" && (
        <>
          <Section title="Dados do gráfico">
            <TextArea mono rows={7} value={block.data} onChange={(value) => set({ data: value }, "data")} />
            <p className="-mt-1 text-[11px] leading-snug text-ink-400">Primeira linha: nomes das séries. Separe com ponto e vírgula — ou cole direto do Excel.</p>
            <Field label="Tipo">
              <Select
                value={block.chartType}
                onChange={(value) => set({ chartType: value })}
                options={[
                  { value: "bar", label: "Colunas" },
                  { value: "barh", label: "Barras deitadas" },
                  { value: "line", label: "Linhas" },
                  { value: "area", label: "Área" },
                  { value: "pie", label: "Pizza" },
                  { value: "donut", label: "Rosca" },
                ]}
              />
            </Field>
            <Field label="Formato dos números">
              <Segmented
                value={block.format}
                onChange={(value) => set({ format: value })}
                options={[
                  { value: "number", label: "1.234" },
                  { value: "money", label: "R$" },
                  { value: "percent", label: "%" },
                ]}
              />
            </Field>
            <Toggle label="Legenda" checked={block.showLegend} onChange={(value) => set({ showLegend: value })} />
            <Toggle label="Mostrar valores" checked={block.showValues} onChange={(value) => set({ showValues: value })} />
            {!["pie", "donut"].includes(block.chartType) && <Toggle label="Linhas de grade" checked={block.showGrid} onChange={(value) => set({ showGrid: value })} />}
            {["bar", "barh", "area"].includes(block.chartType) && <Toggle label="Empilhado" checked={block.stacked} onChange={(value) => set({ stacked: value })} />}
            <Field label="Cores">
              <ChartColorsField colors={block.colors} theme={theme} onChange={(value) => set({ colors: value })} />
            </Field>
          </Section>
          <Section title="Texto">
            <Field label="Título">
              <TextInput value={block.title} onChange={(value) => set({ title: value }, "title")} />
            </Field>
            <Row>
              <Field label="Fonte do título">
                <FontSelect value={block.titleFont || "@heading"} onChange={(value) => set({ titleFont: value })} theme={theme} />
              </Field>
              <Field label="Tamanho do título">
                <NumberInput value={block.titleSize || 20} min={8} max={120} onChange={(value) => set({ titleSize: value }, "titleSize")} suffix="px" />
              </Field>
            </Row>
            <Row>
              <Field label="Fonte dos rótulos">
                <FontSelect value={block.font || "@body"} onChange={(value) => set({ font: value })} theme={theme} />
              </Field>
              <Field label="Tamanho dos rótulos">
                <NumberInput value={block.fontSize} min={8} max={48} onChange={(value) => set({ fontSize: value }, "fontSize")} suffix="px" />
              </Field>
            </Row>
          </Section>
        </>
      )}

      {block.kind === "table" && (
        <Section title="Tabela">
          <TextArea mono rows={7} value={block.data} onChange={(value) => set({ data: value }, "data")} />
          <p className="-mt-1 text-[11px] leading-snug text-ink-400">Uma linha por linha da tabela; colunas separadas por ponto e vírgula — ou cole do Excel. A primeira linha é o cabeçalho.</p>
          <Field label="Fonte">
            <FontSelect value={block.font} onChange={(value) => set({ font: value })} theme={theme} />
          </Field>
          <Row>
            <Field label="Tamanho">
              <NumberInput value={block.fontSize} min={8} max={60} onChange={(value) => set({ fontSize: value }, "fontSize")} suffix="px" />
            </Field>
            <Field label="Cor do texto">
              <ColorField compact value={block.color} onChange={(value) => set({ color: value })} theme={theme} />
            </Field>
          </Row>
          <Row>
            <Field label="Fundo do cabeçalho">
              <ColorField compact value={block.headerFill} onChange={(value) => set({ headerFill: value })} theme={theme} allowNone />
            </Field>
            <Field label="Texto do cabeçalho">
              <ColorField compact value={block.headerColor} onChange={(value) => set({ headerColor: value })} theme={theme} />
            </Field>
          </Row>
          <Toggle label="Linhas zebradas" checked={block.stripe} onChange={(value) => set({ stripe: value })} />
          {block.stripe && <ColorField value={block.stripeColor} onChange={(value) => set({ stripeColor: value })} theme={theme} />}
          <Field label="Cor das linhas divisórias">
            <ColorField value={block.lineColor} onChange={(value) => set({ lineColor: value })} theme={theme} />
          </Field>
          <Toggle label="Primeira coluna em negrito" checked={block.firstColBold} onChange={(value) => set({ firstColBold: value })} />
          <Toggle label="Última linha em negrito (total)" checked={block.lastRowBold} onChange={(value) => set({ lastRowBold: value })} />
        </Section>
      )}

      {block.kind === "meta" && (
        <Section title="Meta">
          <Field label="Título">
            <TextInput value={block.label} onChange={(value) => set({ label: value }, "label")} />
          </Field>
          <Field label="Valor atual">
            <Segmented
              value={block.source}
              onChange={(value) => set({ source: value })}
              options={[
                { value: "manual", label: "Digitar" },
                { value: "kpi", label: "Do B.I." },
              ]}
            />
          </Field>
          {block.source === "kpi" ? (
            <button type="button" onClick={() => openPicker("meta")} className="h-9 rounded-lg border border-line text-[12.5px] font-medium text-ink-800 hover:border-accent-400 hover:text-accent-600">
              {definition?.label || "Escolher indicador"}
            </button>
          ) : (
            <NumberInput value={block.current} onChange={(value) => set({ current: value }, "current")} />
          )}
          <Field label="Meta">
            <NumberInput value={block.target} onChange={(value) => set({ target: value }, "target")} />
          </Field>
          {block.source === "manual" && (
            <Field label="Formato">
              <Segmented
                value={block.format}
                onChange={(value) => set({ format: value })}
                options={[
                  { value: "number", label: "1.234" },
                  { value: "money", label: "R$" },
                  { value: "percent", label: "%" },
                ]}
              />
            </Field>
          )}
          <Field label="Estilo">
            <Segmented
              value={block.variant}
              onChange={(value) => set({ variant: value })}
              options={[
                { value: "barra", label: "Barra" },
                { value: "anel", label: "Anel" },
              ]}
            />
          </Field>
          <Field label="Cor">
            <ColorField value={block.barColor} onChange={(value) => set({ barColor: value })} theme={theme} />
          </Field>
          <Field label="Fonte">
            <FontSelect value={block.font} onChange={(value) => set({ font: value })} theme={theme} />
          </Field>
          {block.variant === "barra" && (
            <>
              <Row>
                <Field label="Tamanho do %">
                  <NumberInput value={block.valueSize || 40} min={10} max={160} onChange={(value) => set({ valueSize: value }, "valueSize")} suffix="px" />
                </Field>
                <Field label="Tamanho do título">
                  <NumberInput value={block.labelSize || 20} min={8} max={80} onChange={(value) => set({ labelSize: value }, "labelSize")} suffix="px" />
                </Field>
              </Row>
              <Field label="Espessura da barra">
                <Slider value={block.barHeight || 16} min={4} max={80} onChange={(value) => set({ barHeight: value }, "barHeight")} suffix="px" />
              </Field>
            </>
          )}
        </Section>
      )}

      {block.kind === "image" && <ImageContentSection block={block} set={set} onUploadImage={onUploadImage} brandLogos={brandLogos} canSaveLogo={canSaveLogo} onSaveLogo={onSaveLogo} />}

      {block.kind === "shape" && (
        <Section title="Forma">
          <div className="grid grid-cols-5 gap-1.5">
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                title={shape.label}
                onClick={() => set({ shape: shape.id })}
                className={`flex aspect-square items-center justify-center rounded-md border ${block.shape === shape.id ? "border-accent-500 bg-accent-50" : "border-line hover:border-accent-400"}`}
              >
                <ShapeGlyph id={shape.id} points={shape.points} />
              </button>
            ))}
          </div>
        </Section>
      )}

      {block.kind === "icon" && (
        <Section title="Ícone">
          <button type="button" onClick={() => openPicker("icon")} className="h-9 rounded-lg border border-line text-[12.5px] font-medium text-ink-800 hover:border-accent-400 hover:text-accent-600">
            Trocar ícone ({block.icon})
          </button>
          <Field label="Cor do ícone">
            <ColorField value={block.color} onChange={(value) => set({ color: value })} theme={theme} />
          </Field>
          <Field label="Tamanho do ícone">
            <Slider value={block.iconScale || 55} min={15} max={100} onChange={(value) => set({ iconScale: value }, "iconScale")} suffix="%" />
          </Field>
          <Field label="Espessura do traço">
            <Slider value={block.strokeWidth || 2} min={0.5} max={4} step={0.25} onChange={(value) => set({ strokeWidth: value }, "strokeWidth")} />
          </Field>
        </Section>
      )}

      <AppearanceSection block={block} theme={theme} setStyle={setStyle} set={set} />
      <PositionSection block={block} set={set} actions={actions} />
      <Section title="Animação ao apresentar" defaultOpen={false}>
        <Select value={block.anim || "none"} onChange={(value) => set({ anim: value })} options={ANIMATIONS.map((item) => ({ value: item.id, label: item.label }))} />
        <p className="-mt-1 text-[11px] text-ink-400">Os blocos animados entram em sequência, na ordem das camadas.</p>
      </Section>
    </div>
  );
}

function ShapeGlyph({ id, points }) {
  if (id === "rect") return <span className="h-5 w-6 rounded-sm bg-ink-500" />;
  if (id === "ellipse") return <span className="h-6 w-6 rounded-full bg-ink-500" />;
  if (id === "line") return <span className="h-0.5 w-6 rounded bg-ink-500" />;
  return (
    <svg viewBox="0 0 100 100" className="h-6 w-6">
      <polygon points={points} className="fill-ink-500" />
    </svg>
  );
}

export function MultiInspector({ count, actions }) {
  return (
    <div>
      <div className="px-4 pb-3 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">Seleção</p>
        <p className="text-[14px] font-medium text-ink-900">{count} blocos</p>
      </div>
      <Section title="Alinhar entre si">
        <div className="grid grid-cols-6 gap-1">
          <IconButton icon={AlignStartVertical} title="Pela esquerda" onClick={() => actions.align("left")} />
          <IconButton icon={AlignCenterVertical} title="Pelo centro (horizontal)" onClick={() => actions.align("hcenter")} />
          <IconButton icon={AlignEndVertical} title="Pela direita" onClick={() => actions.align("right")} />
          <IconButton icon={AlignStartHorizontal} title="Por cima" onClick={() => actions.align("top")} />
          <IconButton icon={AlignCenterHorizontal} title="Pelo meio (vertical)" onClick={() => actions.align("vcenter")} />
          <IconButton icon={AlignEndHorizontal} title="Por baixo" onClick={() => actions.align("bottom")} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={() => actions.distribute("x")} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-line text-[12px] text-ink-700 hover:bg-surface-muted">
            <AlignHorizontalSpaceAround size={14} /> Espaçar na horizontal
          </button>
          <button type="button" onClick={() => actions.distribute("y")} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-line text-[12px] text-ink-700 hover:bg-surface-muted">
            <AlignVerticalSpaceAround size={14} /> Espaçar na vertical
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={() => actions.matchSize("w")} className="h-8 rounded-md border border-line text-[12px] text-ink-700 hover:bg-surface-muted">
            Mesma largura
          </button>
          <button type="button" onClick={() => actions.matchSize("h")} className="h-8 rounded-md border border-line text-[12px] text-ink-700 hover:bg-surface-muted">
            Mesma altura
          </button>
        </div>
      </Section>
      <div className="grid grid-cols-2 gap-1 px-4 py-3">
        <button type="button" onClick={actions.duplicate} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-line text-[12px] text-ink-700 hover:bg-surface-muted">
          <Copy size={14} /> Duplicar
        </button>
        <button type="button" onClick={actions.remove} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-line text-[12px] text-danger-600 hover:bg-danger-50">
          <Trash2 size={14} /> Apagar
        </button>
      </div>
    </div>
  );
}

// Miniatura do fundo: o padrão (pontos, grade…) encolhe junto, senão a
// amostra pequena mostraria só dois ou três pontos.
function shrinkSize(size) {
  if (!size || !size.includes("px")) return size;
  return size.replace(/(\d+(?:\.\d+)?)px/g, (match, value) => `${Number(value) / 3}px`);
}

function BackgroundPreview({ bg, theme, active, onClick, label }) {
  const { css } = slideBackground({ bg }, theme);
  return (
    <button type="button" title={label} onClick={onClick} className={`flex flex-col items-center gap-1 text-[10.5px] ${active ? "text-accent-600" : "text-ink-500 hover:text-ink-800"}`}>
      <span className={`block aspect-video w-full rounded-md ring-1 ${active ? "ring-2 ring-accent-500" : "ring-line"}`} style={{ ...css, backgroundSize: shrinkSize(css.backgroundSize) }} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function sameBg(a, b) {
  return JSON.stringify(a || { type: "theme" }) === JSON.stringify(b || { type: "theme" });
}

export function BackgroundSection({ slide, theme, setSlide, onUploadBg, onApplyAll }) {
  const bg = slide.bg || { type: "theme" };
  const setBg = (patch, key) => setSlide({ bg: { ...bg, ...patch } }, key);
  return (
    <Section title="Fundo do slide">
      <p className="-mt-1 text-[11px] text-ink-400">Sugestões — as primeiras seguem as cores do tema.</p>
      <div className="grid grid-cols-4 gap-2">
        {backgroundSuggestions().map((item) => (
          <BackgroundPreview key={item.label} label={item.label} bg={item.bg} theme={theme} active={sameBg(item.bg, bg)} onClick={() => setSlide({ bg: structuredClone(item.bg) })} />
        ))}
      </div>
      <Field label="Tipo">
        <Select
          value={bg.type}
          onChange={(value) => setSlide({ bg: { ...bg, type: value, color: bg.color || "@bg", color2: bg.color2 || "@accent", colors: bg.colors || ["@accent", "@accent2", "@accent3"], pattern: bg.pattern || "pontos", patternColor: bg.patternColor || "@muted" } })}
          options={[
            { value: "theme", label: "Do tema" },
            { value: "solid", label: "Cor sólida" },
            { value: "gradient", label: "Degradê" },
            { value: "mesh", label: "Malha de cores" },
            { value: "pattern", label: "Padrão (pontos, grade…)" },
            { value: "image", label: "Imagem" },
          ]}
        />
      </Field>
      {bg.type !== "theme" && bg.type !== "image" && (
        <Field label={bg.type === "gradient" ? "Cor inicial" : "Cor de fundo"}>
          <ColorField value={bg.color} onChange={(value) => setBg({ color: value })} theme={theme} />
        </Field>
      )}
      {bg.type === "gradient" && (
        <>
          <Field label="Cor final">
            <ColorField value={bg.color2} onChange={(value) => setBg({ color2: value })} theme={theme} />
          </Field>
          <Field label="Forma">
            <Segmented
              value={bg.gradType || "linear"}
              onChange={(value) => setBg({ gradType: value })}
              options={[
                { value: "linear", label: "Linear" },
                { value: "radial", label: "Radial" },
              ]}
            />
          </Field>
          {(bg.gradType || "linear") === "linear" && (
            <Field label="Direção">
              <Slider value={bg.angle ?? 135} min={0} max={360} step={5} onChange={(value) => setBg({ angle: value }, "bgAngle")} suffix="°" />
            </Field>
          )}
        </>
      )}
      {bg.type === "mesh" && (
        <>
          <Field label="Cores das manchas">
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <ColorField
                  key={i}
                  compact
                  allowNone
                  value={(bg.colors || [])[i] || ""}
                  theme={theme}
                  onChange={(value) => {
                    const colors = [...(bg.colors || [])];
                    colors[i] = value;
                    setBg({ colors });
                  }}
                />
              ))}
            </div>
          </Field>
          <Field label="Intensidade">
            <Slider value={bg.intensity ?? 40} min={5} max={100} onChange={(value) => setBg({ intensity: value }, "bgIntensity")} suffix="%" />
          </Field>
        </>
      )}
      {bg.type === "pattern" && (
        <>
          <Field label="Padrão">
            <Select value={bg.pattern || "pontos"} onChange={(value) => setBg({ pattern: value })} options={PATTERNS.map((item) => ({ value: item.id, label: item.label }))} />
          </Field>
          <Field label="Cor do padrão">
            <ColorField value={bg.patternColor} onChange={(value) => setBg({ patternColor: value })} theme={theme} />
          </Field>
          <Row>
            <Field label="Intensidade">
              <Slider value={bg.patternOpacity ?? 20} min={2} max={100} onChange={(value) => setBg({ patternOpacity: value }, "bgPatternOpacity")} suffix="%" />
            </Field>
            <Field label="Tamanho">
              <Slider value={bg.patternSize ?? 24} min={8} max={80} onChange={(value) => setBg({ patternSize: value }, "bgPatternSize")} suffix="px" />
            </Field>
          </Row>
        </>
      )}
      {bg.type === "image" && (
        <>
          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent-500 text-[12.5px] font-medium text-white hover:bg-accent-600">
            <ImageIcon size={14} />
            {bg.image ? "Trocar imagem de fundo" : "Escolher imagem de fundo"}
            <input type="file" accept="image/*" className="hidden" onChange={(event) => onUploadBg(event.target.files?.[0])} />
          </label>
          <Field label="Película por cima (deixa o texto legível)">
            <ColorField value={bg.overlayColor || "#000000"} onChange={(value) => setBg({ overlayColor: value })} theme={theme} />
          </Field>
          <Slider value={bg.overlay ?? 40} min={0} max={95} onChange={(value) => setBg({ overlay: value }, "bgOverlay")} suffix="%" />
        </>
      )}
      <Field label={bg.grain == null ? `Textura granulada (do tema: ${theme.grain || 0}%)` : "Textura granulada"}>
        <Slider value={bg.grain ?? theme.grain ?? 0} min={0} max={100} step={5} onChange={(value) => setBg({ grain: value }, "bgGrain")} suffix="%" />
      </Field>
      <button type="button" onClick={onApplyAll} className="h-8 rounded-md border border-line text-[12px] text-ink-700 hover:border-accent-400 hover:text-accent-600">
        Usar este fundo em todos os slides
      </button>
    </Section>
  );
}

export function SlideInspector({ slide, deck, setSlide, onUploadBg, onApplyBgAll, onSelectBlock, onToggleBlock }) {
  const theme = deck.theme;
  const decoration = slide.decoration || "@theme";
  return (
    <div>
      <div className="px-4 pb-3 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">Slide</p>
        <p className="text-[12px] text-ink-500">Clique num bloco pra editar ele. Sem nada selecionado, você edita o slide.</p>
      </div>
      <BackgroundSection slide={slide} theme={theme} setSlide={setSlide} onUploadBg={onUploadBg} onApplyAll={onApplyBgAll} />
      <Section title="Decoração">
        <div className="grid grid-cols-3 gap-2">
          {[{ id: "@theme", label: "Do tema" }, ...DECORATIONS].map((item) => (
            <button key={item.id} type="button" onClick={() => setSlide({ decoration: item.id })} className={`flex flex-col items-center gap-1 text-[10.5px] ${decoration === item.id ? "text-accent-600" : "text-ink-500 hover:text-ink-800"}`}>
              <span className={`relative block aspect-video w-full overflow-hidden rounded-md ring-1 ${decoration === item.id ? "ring-2 ring-accent-500" : "ring-line"}`} style={{ background: theme.colors.bg }}>
                <span style={{ position: "absolute", left: 0, top: 0, width: 1280, height: 720, transform: "scale(0.066)", transformOrigin: "0 0" }}>
                  <Decoration id={item.id === "@theme" ? theme.decoration : item.id} theme={theme} />
                </span>
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Opções">
        <Toggle label="Esconder rodapé neste slide" checked={Boolean(slide.hideFooter)} onChange={(value) => setSlide({ hideFooter: value })} />
        <Toggle label="Pular este slide (não apresenta nem vai pro PDF)" checked={Boolean(slide.hidden)} onChange={(value) => setSlide({ hidden: value })} />
        <Field label="Transição ao entrar">
          <Select value={slide.transition || "@deck"} onChange={(value) => setSlide({ transition: value })} options={[{ value: "@deck", label: "A da apresentação" }, ...TRANSITIONS.map((item) => ({ value: item.id, label: item.label }))]} />
        </Field>
      </Section>
      <Section title="Anotações do apresentador">
        <TextArea rows={4} value={slide.notes || ""} placeholder="Só você vê (tecla N no modo apresentação)." onChange={(value) => setSlide({ notes: value }, "notes")} />
      </Section>
      <Section title={`Camadas (${slide.blocks.length})`}>
        {slide.blocks.length === 0 && <p className="text-[12px] text-ink-400">Nenhum bloco ainda — use a barra de cima pra inserir.</p>}
        <div className="flex flex-col gap-0.5">
          {[...slide.blocks].reverse().map((block) => (
            <div key={block.id} className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-surface-muted">
              <button type="button" onClick={() => onSelectBlock(block.id)} className={`min-w-0 flex-1 truncate text-left text-[12.5px] ${block.hidden ? "text-ink-400 line-through" : "text-ink-700"}`}>
                <span className="mr-1.5 text-[10.5px] uppercase text-ink-400">{KIND_LABEL[block.kind]}</span>
                {blockName(block)}
              </button>
              <button type="button" title={block.hidden ? "Mostrar" : "Esconder"} onClick={() => onToggleBlock(block.id, "hidden")} className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-800">
                {block.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button type="button" title={block.locked ? "Destravar" : "Travar"} onClick={() => onToggleBlock(block.id, "locked")} className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-800">
                {block.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function ThemeInspector({ deck, setDeck, brandLogos }) {
  const theme = deck.theme;
  const footer = deck.footer || {};
  const setTheme = (patch, key) => setDeck({ theme: { ...theme, ...patch } }, key);
  const setColor = (colorKey, value) => setDeck({ theme: { ...theme, colors: { ...theme.colors, [colorKey]: value } } }, `color:${colorKey}`);
  const setFooter = (patch, key) => setDeck({ footer: { ...footer, ...patch } }, key);
  return (
    <div>
      <Section title="Temas prontos">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((preset) => {
            const active = theme.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDeck({ theme: themeById(preset.id) })}
                className={`overflow-hidden rounded-lg text-left ring-1 transition-all ${active ? "ring-2 ring-accent-500" : "ring-line hover:ring-accent-300"}`}
              >
                <span className="relative block h-14 overflow-hidden" style={{ background: preset.colors.bg }}>
                  <span className="absolute left-2.5 top-2 text-[13px] font-bold" style={{ color: preset.colors.text, fontFamily: fontStack(preset.headingFont, preset) }}>
                    Aa
                  </span>
                  <span className="absolute bottom-2 left-2.5 flex gap-1">
                    {["accent", "accent2", "accent3"].map((key) => (
                      <span key={key} className="h-3 w-3 rounded-full" style={{ background: preset.colors[key] }} />
                    ))}
                  </span>
                  <span className="absolute -right-3 -top-3 h-10 w-10 rounded-full opacity-60" style={{ background: preset.colors.surface }} />
                </span>
                <span className="block px-2 py-1 text-[11.5px] font-medium text-ink-700">{preset.name}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-400">Trocar o tema recolore tudo que usa as cores do tema — o que você pintou com uma cor fixa continua igual.</p>
      </Section>
      <Section title="Cores do tema">
        <div className="grid grid-cols-2 gap-2">
          {THEME_COLOR_KEYS.map((item) => (
            <Field key={item.key} label={item.label}>
              <ColorField plain value={theme.colors[item.key]} onChange={(value) => setColor(item.key, value)} theme={theme} />
            </Field>
          ))}
        </div>
      </Section>
      <Section title="Fontes do tema">
        <Field label="Títulos">
          <FontSelect allowTheme={false} value={theme.headingFont} onChange={(value) => setTheme({ headingFont: value })} theme={theme} />
        </Field>
        <Field label="Textos">
          <FontSelect allowTheme={false} value={theme.bodyFont} onChange={(value) => setTheme({ bodyFont: value })} theme={theme} />
        </Field>
      </Section>
      <Section title="Cartões e decoração">
        <Field label="Cantos dos cartões">
          <Slider value={theme.radius} min={0} max={60} onChange={(value) => setTheme({ radius: value }, "radius")} suffix="px" />
        </Field>
        <Field label="Estilo dos cartões">
          <Segmented value={theme.cardStyle || "solid"} onChange={(value) => setTheme({ cardStyle: value })} options={CARD_STYLES.map((item) => ({ value: item.id, label: item.label }))} />
        </Field>
        <Field label="Sombra dos cartões">
          <Select value={theme.shadow} onChange={(value) => setTheme({ shadow: value })} options={SHADOWS.map((item) => ({ value: item.id, label: item.label }))} />
        </Field>
        <Field label="Textura granulada no fundo">
          <Slider value={theme.grain || 0} min={0} max={100} step={5} onChange={(value) => setTheme({ grain: value }, "grain")} suffix="%" />
        </Field>
        <Field label="Decoração padrão dos slides">
          <Select value={theme.decoration} onChange={(value) => setTheme({ decoration: value })} options={DECORATIONS.map((item) => ({ value: item.id, label: item.label }))} />
        </Field>
        <Field label="Transição entre slides">
          <Select value={deck.transition || "fade"} onChange={(value) => setDeck({ transition: value })} options={TRANSITIONS.map((item) => ({ value: item.id, label: item.label }))} />
        </Field>
      </Section>
      <Section title="Rodapé">
        <Toggle label="Mostrar rodapé" checked={footer.show !== false} onChange={(value) => setFooter({ show: value })} />
        {footer.show !== false && (
          <>
            <Field label="Texto (aceita {empresa}, {periodo}…)">
              <TextInput value={footer.text || ""} onChange={(value) => setFooter({ text: value }, "footerText")} />
            </Field>
            <Toggle label="Número da página" checked={Boolean(footer.pageNumber)} onChange={(value) => setFooter({ pageNumber: value })} />
            <Field label="Logo no rodapé">
              <Select
                value={footer.logo || "none"}
                onChange={(value) => setFooter({ logo: value })}
                options={[
                  { value: "none", label: "Sem logo" },
                  { value: "athos", label: "Athos (clara/escura automática)" },
                  { value: "athos-marca", label: "Só o símbolo da Athos" },
                  { value: "contac", label: "Contac (clara/escura automática)" },
                  { value: "contac-marca", label: "Só o símbolo da Contac" },
                  ...(brandLogos || []).map((logo) => ({ value: logo.src, label: logo.name })),
                ]}
              />
            </Field>
            {footer.logo && footer.logo !== "none" && (
              <div className="flex h-10 items-center justify-center rounded-md ring-1 ring-line" style={{ background: theme.colors.bg }}>
                <img src={footer.logo.startsWith("data:") ? footer.logo : brandSrc(footer.logo, theme.colors.bg)} alt="" className="h-6" />
              </div>
            )}
            <Row>
              <Field label="Fonte">
                <FontSelect value={footer.font || "@body"} onChange={(value) => setFooter({ font: value })} theme={theme} />
              </Field>
              <Field label="Tamanho">
                <NumberInput value={footer.size || 14} min={8} max={40} onChange={(value) => setFooter({ size: value }, "footerSize")} suffix="px" />
              </Field>
            </Row>
            <Field label="Cor">
              <ColorField value={footer.color || "@muted"} onChange={(value) => setFooter({ color: value })} theme={theme} />
            </Field>
          </>
        )}
      </Section>
    </div>
  );
}
