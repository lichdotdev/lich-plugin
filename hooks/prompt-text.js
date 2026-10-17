// The agent-facing text the hooks add to a session, in every language lich can
// talk to its agents in. lich exports the user's prompt language into every
// session as LICH_PROMPT_LANG (`internal/prompt` there); an empty or unknown
// value is English, as it is for lich itself.
//
// A text is a template with `{name}` slots. Tool and command names, the `[lich]`
// marker and the status enums are literal in every locale: the model matches on
// them, and so does the contract.

/** @type {Record<string, string>} */
export const en = {
  askPreamble:
    "This is a side question asked from outside your turn, while you work. It does not " +
    "interrupt your turn and your answer is not added to the conversation. Tools are " +
    "unavailable: do not call any tool. Answer from what the conversation already holds, " +
    "in plain text, briefly. Question: ",
  onBranch: "on branch {branch}",
  whereBranch: "on branch {branch} in {path}, not in this checkout",
  whereShared: "in this same checkout, {path}, and edits its files as you do",
  backgrounded:
    'The agent runs as the lich session "{label}", {where}. ' +
    "Its full report arrives at this prompt on its own as a [lich] note, not as a task notification, so there " +
    "is no need to call wait_for_answer (it still works). SendMessage cannot reach that session; " +
    "send_to_session or lich send can.",
  completedBranch:
    'The work is on branch {branch} in {path} (lich session "{label}"), not in this checkout. ' +
    "Reach that session with send_to_session or lich send, not SendMessage.",
  completedShared:
    'The work is in this same checkout, {path} (lich session "{label}"). ' +
    "Reach that session with send_to_session or lich send, not SendMessage.",
  denyNeverReached: 'the task never reached "{label}" ({status}): open its card.',
  denyAnswered: 'lich answered "{status}" about "{label}"{branchPart}: open its card.',
  denyInterrupted:
    "interrupted; a lich session{branchPart} may already have the task, and a report it sends arrives here as a [lich] note.",
  denyStopFailed: 'lich could not stop "{label}": {reason}',
  lichExited: "lich exited {code}",
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
  onBranch: "na branch {branch}",
  whereBranch: "na branch {branch} em {path}, não neste checkout",
  whereShared: "neste mesmo checkout, {path}, e edita os arquivos dele como você",
  backgrounded:
    'O agente roda como a sessão lich "{label}", {where}. ' +
    "O relatório completo chega neste prompt por conta própria como uma nota [lich], não como task notification, " +
    "então não é preciso chamar wait_for_answer (ele ainda funciona). SendMessage não alcança essa sessão; " +
    "send_to_session ou lich send alcançam.",
  completedBranch:
    'O trabalho está na branch {branch} em {path} (sessão lich "{label}"), não neste checkout. ' +
    "Fale com essa sessão por send_to_session ou lich send, não por SendMessage.",
  completedShared:
    'O trabalho está neste mesmo checkout, {path} (sessão lich "{label}"). ' +
    "Fale com essa sessão por send_to_session ou lich send, não por SendMessage.",
  denyNeverReached: 'a tarefa nunca chegou a "{label}" ({status}): abra o card dela.',
  denyAnswered: 'o lich respondeu "{status}" sobre "{label}"{branchPart}: abra o card dela.',
  denyInterrupted:
    "interrompido; uma sessão lich{branchPart} pode já ter a tarefa, e o relatório que ela enviar chega aqui como nota [lich].",
  denyStopFailed: 'o lich não conseguiu parar "{label}": {reason}',
  lichExited: "o lich saiu com {code}",
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
  onBranch: "在分支 {branch} 上",
  whereBranch: "在分支 {branch} 上的 {path} 中，不在当前 checkout 里",
  whereShared: "在同一个 checkout {path} 中，并且和你一样编辑其中的文件",
  backgrounded:
    'agent 作为 lich 会话 "{label}" 运行，{where}。' +
    "它的完整报告会作为 [lich] 备注自动出现在此提示中，而不是 task notification，因此无需调用 " +
    "wait_for_answer（调用仍然有效）。SendMessage 无法联系该会话；send_to_session 或 lich send 可以。",
  completedBranch:
    '工作位于分支 {branch} 上的 {path}（lich 会话 "{label}"），不在当前 checkout 里。' +
    "请通过 send_to_session 或 lich send 联系该会话，不要用 SendMessage。",
  completedShared:
    '工作位于同一个 checkout {path}（lich 会话 "{label}"）中。' +
    "请通过 send_to_session 或 lich send 联系该会话，不要用 SendMessage。",
  denyNeverReached: '任务从未送达 "{label}"（{status}）：请打开它的卡片。',
  denyAnswered: 'lich 针对 "{label}"{branchPart} 返回了 "{status}"：请打开它的卡片。',
  denyInterrupted:
    "已中断；某个 lich 会话{branchPart}可能已经拿到任务，它发送的报告会作为 [lich] 备注出现在这里。",
  denyStopFailed: 'lich 无法停止 "{label}"：{reason}',
  lichExited: "lich 退出，退出码 {code}",
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
  onBranch: "en la rama {branch}",
  whereBranch: "en la rama {branch} en {path}, no en este checkout",
  whereShared: "en este mismo checkout, {path}, y edita sus archivos igual que tú",
  backgrounded:
    'El agente se ejecuta como la sesión lich "{label}", {where}. ' +
    "Su informe completo llega a este prompt por sí solo como una nota [lich], no como task notification, así que no " +
    "hace falta llamar a wait_for_answer (sigue funcionando). SendMessage no puede llegar a esa sesión; " +
    "send_to_session o lich send sí.",
  completedBranch:
    'El trabajo está en la rama {branch} en {path} (sesión lich "{label}"), no en este checkout. ' +
    "Comunícate con esa sesión con send_to_session o lich send, no con SendMessage.",
  completedShared:
    'El trabajo está en este mismo checkout, {path} (sesión lich "{label}"). ' +
    "Comunícate con esa sesión con send_to_session o lich send, no con SendMessage.",
  denyNeverReached: 'la tarea nunca llegó a "{label}" ({status}): abre su tarjeta.',
  denyAnswered: 'lich respondió "{status}" sobre "{label}"{branchPart}: abre su tarjeta.',
  denyInterrupted:
    "interrumpido; puede que una sesión lich{branchPart} ya tenga la tarea, y el informe que envíe llega aquí como una nota [lich].",
  denyStopFailed: 'lich no pudo detener "{label}": {reason}',
  lichExited: "lich terminó con {code}",
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
  onBranch: "ブランチ {branch}",
  whereBranch: "ブランチ {branch} の {path} で、このチェックアウトではありません",
  whereShared: "同じこのチェックアウト {path} で、あなたと同じようにそのファイルを編集します",
  backgrounded:
    'エージェントは lich セッション "{label}" として動いています（{where}）。' +
    "そのレポート全体は、task notification ではなく [lich] の通知として、このプロンプトに自動で届きます。" +
    "そのため wait_for_answer を呼ぶ必要はありません（呼んでも動作します）。SendMessage ではそのセッションに届きません。" +
    "send_to_session または lich send なら届きます。",
  completedBranch:
    '作業はブランチ {branch} の {path} にあり（lich セッション "{label}"）、このチェックアウトにはありません。' +
    "そのセッションには SendMessage ではなく、send_to_session または lich send で連絡してください。",
  completedShared:
    '作業は同じこのチェックアウト {path} にあります（lich セッション "{label}"）。' +
    "そのセッションには SendMessage ではなく、send_to_session または lich send で連絡してください。",
  denyNeverReached: 'タスクは "{label}" に届きませんでした（{status}）：そのカードを開いてください。',
  denyAnswered: 'lich は "{label}"{branchPart} について "{status}" と答えました：そのカードを開いてください。',
  denyInterrupted:
    "中断されました。lich セッション{branchPart}がすでにタスクを受け取っている可能性があり、" +
    "そのセッションが送るレポートは [lich] の通知としてここに届きます。",
  denyStopFailed: 'lich は "{label}" を停止できませんでした：{reason}',
  lichExited: "lich が終了コード {code} で終了しました",
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
  onBranch: "브랜치 {branch}",
  whereBranch: "브랜치 {branch}의 {path}, 이 체크아웃이 아님",
  whereShared: "같은 체크아웃 {path}, 당신처럼 그 파일을 수정함",
  backgrounded:
    '에이전트는 lich 세션 "{label}"에서 실행됩니다({where}). ' +
    "전체 보고서는 task notification이 아니라 [lich] 메모로 이 프롬프트에 알아서 도착하므로, " +
    "wait_for_answer를 호출할 필요가 없습니다(호출해도 동작합니다). SendMessage로는 그 세션에 닿을 수 없고, " +
    "send_to_session이나 lich send로는 닿을 수 있습니다.",
  completedBranch:
    '작업은 브랜치 {branch}의 {path}에 있으며(lich 세션 "{label}"), 이 체크아웃에는 없습니다. ' +
    "그 세션에는 SendMessage가 아니라 send_to_session이나 lich send로 연락하세요.",
  completedShared:
    '작업은 같은 체크아웃 {path}에 있습니다(lich 세션 "{label}"). ' +
    "그 세션에는 SendMessage가 아니라 send_to_session이나 lich send로 연락하세요.",
  denyNeverReached: '작업이 "{label}"에 한 번도 전달되지 않았습니다({status}): 그 카드를 열어 보세요.',
  denyAnswered: 'lich의 답은 "{status}"였습니다("{label}"{branchPart}): 그 카드를 열어 보세요.',
  denyInterrupted:
    "중단되었습니다. 작업이 이미 lich 세션{branchPart}에 있을 수 있으며, 그 세션이 보내는 보고서는 [lich] 메모로 여기에 도착합니다.",
  denyStopFailed: 'lich가 "{label}"을(를) 멈추지 못했습니다: {reason}',
  lichExited: "lich 종료 코드 {code}",
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
  onBranch: "в ветке {branch}",
  whereBranch: "в ветке {branch} в {path}, а не в этой рабочей копии",
  whereShared: "в этой же рабочей копии, {path}, и редактирует её файлы так же, как вы",
  backgrounded:
    'Агент работает как сессия lich "{label}", {where}. ' +
    "Его полный отчёт сам придёт в этот промпт как заметка [lich], а не как task notification, поэтому " +
    "вызывать wait_for_answer не нужно (он по-прежнему работает). SendMessage не может связаться с этой сессией; " +
    "send_to_session или lich send могут.",
  completedBranch:
    'Работа находится в ветке {branch} в {path} (сессия lich "{label}"), а не в этой рабочей копии. ' +
    "Связывайтесь с этой сессией через send_to_session или lich send, а не через SendMessage.",
  completedShared:
    'Работа находится в этой же рабочей копии, {path} (сессия lich "{label}"). ' +
    "Связывайтесь с этой сессией через send_to_session или lich send, а не через SendMessage.",
  denyNeverReached: 'задача так и не дошла до "{label}" ({status}): откройте её карточку.',
  denyAnswered: 'lich ответил "{status}" для "{label}"{branchPart}: откройте её карточку.',
  denyInterrupted:
    "прервано; задача, возможно, уже у сессии lich{branchPart}, и отчёт, который она отправит, придёт сюда как заметка [lich].",
  denyStopFailed: 'lich не смог остановить "{label}": {reason}',
  lichExited: "lich завершился с кодом {code}",
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
