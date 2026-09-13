# Nosso Tempo V2 — Premium Android

Versão 2 do **Nosso Tempo**, refeita para funcionar como aplicativo + **Live Wallpaper nativo** do Android.

## O que entrou na V2

- Live Wallpaper nativo para usar atrás da tela de bloqueio.
- Layout adaptativo para diferentes proporções de tela.
- 5 temas: Vidro, OLED, Aurora, Material e Minimal.
- Cor de destaque personalizável.
- Controle de posição vertical, tamanho e transparência do cartão.
- Mostrar/ocultar segundos, data “Desde…” e próximo marco.
- Símbolo do coração configurável.
- Prévia completa da tela de bloqueio dentro do app.
- Tela inicial com contador principal e próximo marco.
- Marcos automáticos (10, 30, 50, 100 dias, meses, anos etc.).
- Notificação opcional no próximo marco.
- Proteção opcional das configurações com biometria/credencial do Android.
- Backup/importação das configurações em JSON.
- Configurações persistidas em `SharedPreferences` nativo + armazenamento do app.
- Economia de bateria: o wallpaper para de atualizar quando não está visível e, se os segundos forem desativados, atualiza só a cada minuto.
- Modo OLED com fundo realmente preto.
- Ícone adaptativo do Nosso Tempo.
- Workflow GitHub Actions atualizado com Node 22 + Java 21.

## Importante sobre a lock screen

O app não substitui PIN, digital, senha ou notificações do Android. O contador funciona como **Live Wallpaper**, que é a forma suportada pelo sistema para personalizar o fundo da tela de bloqueio.

Depois de instalar:
1. Abra **Nosso Tempo**.
2. Ajuste a data e o visual.
3. Toque em **Aplicar na tela de bloqueio**.
4. O Android abrirá o seletor oficial de Live Wallpaper.
5. Escolha **Tela de bloqueio** ou **Tela inicial e de bloqueio**, conforme o fabricante oferecer.

Alguns fabricantes não permitem Live Wallpaper somente na lock screen. Nesses aparelhos, o Android pode oferecer apenas “Tela inicial e de bloqueio”.

## APK pelo GitHub

O workflow está em:

`.github/workflows/main.yml`

No GitHub:
1. Envie todos os arquivos.
2. Abra **Actions**.
3. Execute **Gerar APK - Nosso Tempo V2**.
4. Baixe o artefato **Nosso-Tempo-V2-APK**.
5. Extraia e instale `app-debug.apk`.

## Data padrão

O contador começa em:

**12/09/2026 às 16:43 (horário de Brasília)**

Você pode mudar dentro do aplicativo.
