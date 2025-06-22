# FinanceBot - Analista Financeiro IA

Um chatbot de análise financeira com capacidades multimodais alimentado pelo modelo Gemma 3 (Google).

## Funcionalidades

- Análise de investimentos e mercados
- Suporte a entrada de texto e imagens
- Interface moderna com Tailwind CSS
- Prompt especializado para análise financeira

## Requisitos

- Node.js (v14 ou superior)
- Ollama (para rodar o modelo Gemma 3)

## Configuração

1. Clone o repositório
2. Instale as dependências:
```
npm install
```

3. Configure o arquivo `.env`:
```
PORT=3000
GEMMA_BASE_URL=http://localhost:11434
GEMMA_MODEL=gemma3:4b
```

4. Instale e configure o Ollama (https://ollama.ai/) e baixe o modelo Gemma 3:
```
ollama pull gemma3:4b
```

5. Inicie o servidor Ollama:
```
ollama serve
```

## Iniciar o servidor

```
npm run dev
```

A aplicação estará disponível em http://localhost:3000

## Arquitetura

- **Frontend**: HTML, CSS (Tailwind), JavaScript
- **Backend**: Node.js, Express
- **IA**: Gemma 3 via Ollama API

## Como usar

1. Faça perguntas sobre finanças, investimentos e economia
2. Envie imagens relevantes (como gráficos, documentos financeiros) para análise
3. Receba análises financeiras baseadas em IA