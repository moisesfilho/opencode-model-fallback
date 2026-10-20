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

## Testes

Execute `npm test` com Node.js 22 ou superior.
