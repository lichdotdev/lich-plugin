// The agent-facing text the hooks add to a session, in every language lich can
// talk to its agents in. lich exports the user's prompt language into every
// session as LICH_PROMPT_LANG (`internal/prompt` there); an empty or unknown
// value is English, as it is for lich itself.
//
// A text is a template with `{name}` slots. Tool and command names are literal
// in every locale: the model matches on them.

/** @type {Record<string, string>} */
export const en = {
  askPreamble:
    "This is a side question asked from outside your turn, while you work. It does not " +
    "interrupt your turn and your answer is not added to the conversation. Tools are " +
    "unavailable: do not call any tool. Answer from what the conversation already holds, " +
    "in plain text, briefly. Question: ",
  editNoteJustNow: "under a minute ago",
  editNoteAgo: "{minutes} min ago",
  editNote:
    "{path} was also edited by the lich session {who} at {at} ({ago}), which shares this checkout and may " +
    "still be working on it. Re-read the file before building on it, and coordinate with that session through " +
    "send_to_session or lich send rather than undoing its change.",
  skillNote:
    "\n\nIn this session a built-in slash command (compact, clear, and the like) can be named here too, " +
    "when the user asks you to run it: it is queued and runs once your turn ends, so end your turn right after.",
  controlNote:
    "\n\nIn this session, action command is accepted with this session itself as the target: pass session " +
    '"{sessionId}". The command is queued and runs once your turn ends, so end your turn right after.',
  denyDefaultSaved:
    "/{name} run from inside the session would be saved as the default for every new Claude Code " +
    "session. Ask the user to set it from lich, whose {name} override applies to this session only.",
  skillQueued: "{queued} is queued and runs once this turn ends. End the turn now.",
  controlQueued: "{queued} is queued on this session and runs once this turn ends. End the turn now.",
}

/** @type {Record<string, string>} */
export const ptBR = {
  askPreamble:
    "Esta é uma pergunta lateral feita de fora do seu turno, enquanto você trabalha. Ela não " +
    "interrompe o seu turno e a sua resposta não entra na conversa. As ferramentas estão " +
    "indisponíveis: não chame nenhuma. Responda com o que a conversa já contém, " +
    "em texto simples e de forma breve. Pergunta: ",
  editNoteJustNow: "há menos de um minuto",
  editNoteAgo: "há {minutes} min",
  editNote:
    "{path} também foi editado pela sessão lich {who} em {at} ({ago}), que divide este checkout e pode " +
    "ainda estar trabalhando nele. Releia o arquivo antes de continuar a partir dele e combine com essa sessão por " +
    "send_to_session ou lich send em vez de desfazer a mudança dela.",
  skillNote:
    "\n\nNesta sessão um slash command embutido (compact, clear e afins) também pode ser nomeado aqui, " +
    "quando o usuário pedir para você executá-lo: ele entra na fila e roda quando o seu turno terminar, então encerre o turno logo em seguida.",
  controlNote:
    "\n\nNesta sessão, a ação command aceita a própria sessão como alvo: passe session " +
    '"{sessionId}". O comando entra na fila e roda quando o seu turno terminar, então encerre o turno logo em seguida.',
  denyDefaultSaved:
    "/{name} executado de dentro da sessão seria salvo como padrão de toda nova sessão do Claude Code. " +
    "Peça ao usuário para definir pelo lich, cujo override de {name} vale só para esta sessão.",
  skillQueued: "{queued} está na fila e roda quando este turno terminar. Encerre o turno agora.",
  controlQueued: "{queued} está na fila nesta sessão e roda quando este turno terminar. Encerre o turno agora.",
}

/** @type {Record<string, string>} */
export const zhCN = {
  askPreamble:
    "这是在你的回合之外、你工作期间提出的旁路问题。它不会打断你的回合，你的回答也不会加入对话。" +
    "工具不可用：不要调用任何工具。请仅根据对话中已有的内容，用纯文本简要回答。问题：",
  editNoteJustNow: "不到一分钟前",
  editNoteAgo: "{minutes} 分钟前",
  editNote:
    "{path} 也被 lich 会话 {who} 在 {at}（{ago}）编辑过，该会话与你共用此 checkout，可能仍在处理它。" +
    "在基于该文件继续之前请重新读取，并通过 send_to_session 或 lich send 与该会话协调，不要撤销它的改动。",
  skillNote:
    "\n\n在此会话中，内置斜杠命令（compact、clear 等）也可以在这里指定，只要用户要求你运行它：" +
    "它会进入队列，在你的回合结束后运行，因此请在之后立即结束你的回合。",
  controlNote:
    "\n\n在此会话中，action 为 command 时可以把会话自身作为目标：传入 session " +
    '"{sessionId}"。该命令会进入队列，在你的回合结束后运行，因此请在之后立即结束你的回合。',
  denyDefaultSaved:
    "在会话内部运行 /{name} 会把它保存为每个新 Claude Code 会话的默认值。" +
    "请让用户通过 lich 来设置，lich 的 {name} 覆盖只对此会话生效。",
  skillQueued: "{queued} 已进入队列，将在本回合结束后运行。现在请结束本回合。",
  controlQueued: "{queued} 已在此会话中排队，将在本回合结束后运行。现在请结束本回合。",
}

/** @type {Record<string, string>} */
export const es = {
  askPreamble:
    "Esta es una pregunta lateral hecha desde fuera de tu turno, mientras trabajas. No " +
    "interrumpe tu turno y tu respuesta no se añade a la conversación. Las herramientas no están " +
    "disponibles: no llames a ninguna. Responde con lo que la conversación ya contiene, " +
    "en texto plano y de forma breve. Pregunta: ",
  editNoteJustNow: "hace menos de un minuto",
  editNoteAgo: "hace {minutes} min",
  editNote:
    "{path} también fue editado por la sesión lich {who} en {at} ({ago}), que comparte este checkout y puede " +
    "seguir trabajando en él. Vuelve a leer el archivo antes de continuar a partir de él y coordínate con esa sesión " +
    "mediante send_to_session o lich send en lugar de deshacer su cambio.",
  skillNote:
    "\n\nEn esta sesión, un slash command integrado (compact, clear y similares) también puede nombrarse aquí, " +
    "cuando el usuario te pida ejecutarlo: se pone en cola y se ejecuta cuando termina tu turno, así que termina tu turno justo después.",
  controlNote:
    "\n\nEn esta sesión, la acción command acepta la propia sesión como destino: pasa session " +
    '"{sessionId}". El comando se pone en cola y se ejecuta cuando termina tu turno, así que termina tu turno justo después.',
  denyDefaultSaved:
    "/{name} ejecutado desde dentro de la sesión se guardaría como valor predeterminado de toda nueva sesión de Claude Code. " +
    "Pide al usuario que lo defina desde lich, cuyo override de {name} vale solo para esta sesión.",
  skillQueued: "{queued} está en cola y se ejecuta cuando termine este turno. Termina el turno ahora.",
  controlQueued: "{queued} está en cola en esta sesión y se ejecuta cuando termine este turno. Termina el turno ahora.",
}

/** @type {Record<string, string>} */
export const ja = {
  askPreamble:
    "これは、あなたが作業している間にターンの外から尋ねられた横からの質問です。あなたのターンを中断することはなく、" +
    "あなたの回答が会話に追加されることもありません。ツールは使えません。どのツールも呼び出さないでください。" +
    "会話にすでにある内容から、プレーンテキストで簡潔に答えてください。質問：",
  editNoteJustNow: "1 分以内",
  editNoteAgo: "{minutes} 分前",
  editNote:
    "{path} は lich セッション {who} によっても {at}（{ago}）に編集されています。そのセッションはこのチェックアウトを" +
    "共有しており、まだ作業中かもしれません。このファイルをもとに作業を進める前に読み直し、その変更を取り消すのではなく、" +
    "send_to_session または lich send でそのセッションと調整してください。",
  skillNote:
    "\n\nこのセッションでは、ユーザーが実行を求めたときに、組み込みのスラッシュコマンド（compact、clear など）も" +
    "ここで指定できます。そのコマンドはキューに入り、あなたのターンが終わると実行されるので、指定したらすぐにターンを終えてください。",
  controlNote:
    "\n\nこのセッションでは、action が command のとき、このセッション自身を対象にできます：session に " +
    '"{sessionId}" を渡してください。コマンドはキューに入り、あなたのターンが終わると実行されるので、すぐにターンを終えてください。',
  denyDefaultSaved:
    "/{name} をセッションの中から実行すると、新しいすべての Claude Code セッションのデフォルトとして保存されてしまいます。" +
    "lich から設定するようユーザーに頼んでください。lich の {name} の上書きはこのセッションにだけ適用されます。",
  skillQueued: "{queued} はキューに入り、このターンが終わると実行されます。今すぐターンを終えてください。",
  controlQueued: "{queued} はこのセッションのキューに入り、このターンが終わると実行されます。今すぐターンを終えてください。",
}

/** @type {Record<string, string>} */
export const ko = {
  askPreamble:
    "이것은 당신이 작업하는 동안 턴 밖에서 들어온 곁가지 질문입니다. 당신의 턴을 중단하지 않으며, 당신의 답은 " +
    "대화에 추가되지 않습니다. 도구는 사용할 수 없습니다. 어떤 도구도 호출하지 마세요. 대화에 이미 있는 내용으로, " +
    "일반 텍스트로 짧게 답하세요. 질문: ",
  editNoteJustNow: "1분 이내",
  editNoteAgo: "{minutes}분 전",
  editNote:
    "{path}은(는) lich 세션 {who}도 {at}({ago})에 수정했습니다. 그 세션은 이 체크아웃을 함께 쓰고 있으며 아직 " +
    "작업 중일 수 있습니다. 이 파일을 바탕으로 작업을 이어 가기 전에 다시 읽고, 그 변경을 되돌리지 말고 " +
    "send_to_session이나 lich send로 그 세션과 조율하세요.",
  skillNote:
    "\n\n이 세션에서는 사용자가 실행을 요청하면 내장 슬래시 명령(compact, clear 등)도 여기서 지정할 수 있습니다. " +
    "그 명령은 대기열에 들어갔다가 당신의 턴이 끝나면 실행되므로, 지정한 직후 턴을 끝내세요.",
  controlNote:
    "\n\n이 세션에서는 action이 command일 때 이 세션 자체를 대상으로 지정할 수 있습니다: session에 " +
    '"{sessionId}"를 전달하세요. 명령은 대기열에 들어갔다가 당신의 턴이 끝나면 실행되므로, 직후에 턴을 끝내세요.',
  denyDefaultSaved:
    "세션 안에서 /{name}을(를) 실행하면 모든 새 Claude Code 세션의 기본값으로 저장됩니다. " +
    "사용자에게 lich에서 설정해 달라고 요청하세요. lich의 {name} 재정의는 이 세션에만 적용됩니다.",
  skillQueued: "{queued}이(가) 대기열에 들어갔고 이 턴이 끝나면 실행됩니다. 지금 턴을 끝내세요.",
  controlQueued: "{queued}이(가) 이 세션의 대기열에 들어갔고 이 턴이 끝나면 실행됩니다. 지금 턴을 끝내세요.",
}

/** @type {Record<string, string>} */
export const ru = {
  askPreamble:
    "Это побочный вопрос, заданный вне вашего хода, пока вы работаете. Он не прерывает ваш ход, и ваш ответ " +
    "не добавляется в разговор. Инструменты недоступны: не вызывайте никаких инструментов. Отвечайте, исходя " +
    "из того, что уже есть в разговоре, простым текстом и кратко. Вопрос: ",
  editNoteJustNow: "меньше минуты назад",
  editNoteAgo: "{minutes} мин назад",
  editNote:
    "{path} также редактировала сессия lich {who} в {at} ({ago}); она использует эту же рабочую копию и, возможно, " +
    "всё ещё работает с ним. Перечитайте файл, прежде чем опираться на него, и согласуйте действия с этой сессией " +
    "через send_to_session или lich send, а не отменяйте её изменение.",
  skillNote:
    "\n\nВ этой сессии здесь также можно назвать встроенную slash-команду (compact, clear и подобные), когда " +
    "пользователь просит вас её выполнить: она ставится в очередь и выполняется, когда ваш ход закончится, поэтому сразу после этого завершите ход.",
  controlNote:
    "\n\nВ этой сессии действие command принимает в качестве цели саму эту сессию: передайте session " +
    '"{sessionId}". Команда ставится в очередь и выполняется, когда ваш ход закончится, поэтому сразу после этого завершите ход.',
  denyDefaultSaved:
    "/{name}, запущенная изнутри сессии, сохранилась бы как значение по умолчанию для каждой новой сессии Claude Code. " +
    "Попросите пользователя задать это из lich: его переопределение {name} действует только для этой сессии.",
  skillQueued: "{queued} поставлена в очередь и выполнится, когда этот ход закончится. Завершите ход сейчас.",
  controlQueued: "{queued} поставлена в очередь в этой сессии и выполнится, когда этот ход закончится. Завершите ход сейчас.",
}

/** @type {Record<string, Record<string, string>>} */
const catalogs = { en, "pt-BR": ptBR, "zh-CN": zhCN, es, ja, ko, ru }

/**
 * The text `key` names in `lang`, its slots filled from `vars`. English stands
 * in for an unknown language; a key missing from English throws, which the
 * parity test turns into a failure long before a session sees it.
 *
 * @param {string | undefined} lang
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
export function say(lang, key, vars = {}) {
  const template = (catalogs[lang ?? "en"] ?? en)[key] ?? en[key]
  if (template === undefined) throw new Error(`no prompt text named "${key}"`)
  return template.replace(/\{(\w+)\}/g, (slot, name) => String(vars[name] ?? slot))
}

/**
 * The catalog language for a LICH_PROMPT_LANG value. The hook reads the env
 * itself: the engine never follows $ across an import.
 *
 * @param {string | undefined} tag
 */
export function promptLang(tag) {
  return tag && tag in catalogs ? tag : "en"
}
