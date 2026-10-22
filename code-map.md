# opencode-model-fallback Code Map

Plugin local para tentativas de fallback de modelo por agente no OpenCode v2.

| Caminho | Responsabilidade |
| --- | --- |
| `index.js` | Registra os hooks de retry e HTTP, escolhe o próximo modelo e descarta o estado após resposta bem-sucedida. |
| `src/register-fallback.js` | Registra retries e troca o modelo da sessão em falhas elegíveis. |
| `src/fallback-policy.js` | Valida configuração, classifica falhas e percorre a lista ordenada. |
| `tests/` | Testes unitários de política, elegibilidade e parsing de referências. |
| `package.json`, `package-lock.json` | Dependência do SDK de plugin OpenCode e comandos do projeto. |
| `README.md`, `README.pt-BR.md` | Instalação/configuração e procedimento para verificar troca e retry via log do plugin e histórico `model-switched` local do OpenCode. |

Validar com `npm test` (Node.js >=22). O smoke test de integração com provedor simulado confirmou retries em sequência no OpenCode v2.0.32.
