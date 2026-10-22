# OpenCode Model Fallback

Plugin para OpenCode v2 que tenta modelos alternativos em ordem, configurados por ID de agente. Ele trata cota, transporte, respostas de modelo inexistente e indisponibilidade do provedor depois que a chamada é enviada. O OpenCode rejeita um ID desconhecido antes de executar o hook de retry; por isso, o modelo configurado precisa existir no catálogo.

## Configuração

Adicione o plugin local ao `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugins": [
    {
      "package": "/caminho/absoluto/opencode-model-fallback",
      "options": {
        "fallback_models": {
          "coder": ["opencode/space-bunny-free", "ollama/qwen2.5-coder:3b"],
          "reviewer": ["openai/gpt-6-luna-fast"]
        }
      }
    }
  ]
}
```

O OpenCode v2 valida os objetos de agente de forma estrita. Por isso, as listas ficam nas opções do plugin, indexadas pelo ID do agente, em vez de propriedades não suportadas dentro da definição do agente. Lista ausente ou vazia desativa o fallback. Use `provedor/modelo`, opcionalmente seguido por `#variante`.

Falhas de cota/limite, autenticação/entitlement, modelo inexistente, timeout de transporte/rede e indisponibilidade do serviço são elegíveis. Erros comuns de requisição inválida não acionam fallback. Quando a lista acaba, o plugin interrompe as tentativas e o erro original continua visível.

## Verificar uma troca de modelo

O plugin registra tentativas aprovadas ou falhas de `switchModel` no stderr do processo OpenCode, com o prefixo `[model-fallback]`. Procure por mensagens como:

```text
[model-fallback] Agent 'reviewer': opencode/model-a failed; retrying with opencode/model-b
[model-fallback] Could not switch to opencode/model-b: ...
```

O primeiro registro significa que o hook de retry classificou o erro como elegível, trocou o modelo da sessão e pediu ao OpenCode para repetir imediatamente. Ele não prova, sozinho, que a repetição terminou com sucesso. A mensagem `Could not switch` indica que a troca falhou; ao esgotar a lista, o retry é interrompido e o erro original permanece.

Também é possível conferir o histórico local de mensagens do OpenCode em `~/.local/share/opencode/opencode.db`, tabela `session_message`, somente leitura. Filtre `type = 'model-switched'` e compare `data.previous` com `data.model`; em seguida confira a mensagem `assistant` subsequente da mesma sessão e agente para ver qual modelo foi usado na repetição. Exemplo de consulta Python, sem imprimir conteúdo das conversas:

```bash
python3 - <<'PY'
import json
import sqlite3

path = "file:/home/USER/.local/share/opencode/opencode.db?mode=ro"
db = sqlite3.connect(path, uri=True)
query = """
SELECT m.session_id, m.time_created, m.data, s.agent
FROM session_message AS m
JOIN session_v2 AS s ON s.id = m.session_id
WHERE m.type = 'model-switched'
ORDER BY m.time_created DESC
LIMIT 50
"""
for session_id, timestamp, raw, agent in db.execute(query):
    event = json.loads(raw)
    previous = event.get("previous", {})
    model = event.get("model", {})
    print(timestamp, session_id, agent,
          f"{previous.get('providerID')}/{previous.get('id')}", "->",
          f"{model.get('providerID')}/{model.get('id')}")
PY
```

Substitua `USER` pelo nome de usuário local. O evento `model-switched` comprova que houve uma troca, mas não identifica quem a iniciou: ela também pode ter sido manual ou causada por outro plugin. Para atribuir ao fallback, correlacione com o registro `[model-fallback]` no log/stderr no mesmo horário. Para comprovar que a nova chamada ocorreu, confirme uma mensagem `assistant` posterior da mesma sessão/agente usando o modelo de destino. Não use apenas uma mudança no modelo atual da sessão como prova de que uma chamada foi repetida.

Se o evento não aparecer, isso não prova por si só que o plugin não executou: retenção/versão do OpenCode e a origem da troca podem limitar o histórico. O plugin não persiste atualmente um log próprio; ausência de `[model-fallback]` deve ser investigada junto aos logs do processo OpenCode e ao histórico da sessão.

## Testes

Execute `npm test` com Node.js 22 ou superior.
