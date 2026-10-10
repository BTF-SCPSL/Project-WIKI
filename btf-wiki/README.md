# BTF Wiki

Стартовая вики **Back To Future**, собранная на Next.js 16 и Fumadocs. Она хранится в этом монорепозитории в самостоятельной папке `btf-wiki/` и использует опубликованные npm-пакеты, а не исходники монорепозитория.

## Локально

Требуется Node.js 24.14+.

```bash
cd btf-wiki
npm install
npm run dev
```

Откройте http://localhost:3000/docs. Проверка работоспособности: http://localhost:3000/api/health.

## Docker

Сборка из **корня репозитория**:

```bash
docker build -t btf-wiki:local ./btf-wiki
docker run --rm -p 3000:3000 btf-wiki:local
```

В Pterodactyl Next.js слушает порт из `SERVER_PORT` (через переменную `PORT`). Код приложения находится внутри образа по пути `/opt/btf-wiki`; рабочий каталог `/home/container` остаётся доступным Pterodactyl.

## GitHub Container Registry

Workflow `.github/workflows/wiki-image.yml` проверяет Docker build при PR в `dev`, а при push в `dev` публикует образ:

```text
ghcr.io/btf-scpsl/project-wiki:latest
```

После первой публикации убедитесь, что GHCR package доступен публично: Pterodactyl Wings должен иметь возможность скачать образ. Для production желательно закреплять образ по версии или digest, а не только `latest`.

## Pterodactyl

1. Admin Panel → Nests → Import Egg.
2. Импортируйте `pterodactyl/egg-btf-wiki.json` из репозитория.
3. Создайте сервер на этом Egg с TCP allocation (например, порт 3000).
4. Укажите DNS/Reverse Proxy: Cloudflare → Nginx → выделенный порт сервера.
5. Запустите сервер. Для проверки используйте `/api/health`.

Egg не скачивает исходники и не устанавливает npm-пакеты: всё уже находится в Docker-образе. Привязка к `/home/container` не удаляет встроенное приложение.

## Статьи

Страницы находятся в `btf-wiki/content/docs/*.mdx`. Для публикации изменений необходимо обновить код в Git и пересобрать образ. Редактор через браузер, MariaDB и OAuth здесь **ещё не реализованы**. Для будущей CMS потребуется динамический источник страниц: само по себе редактирование MDX внутри работающего контейнера не обновит предсобранные страницы Next.js.

## Изоляция от Fumadocs monorepo

Существующие `apps/`, `packages/` и `examples/` не изменяются. Для самостоятельного приложения используется каталог `btf-wiki/` и отдельный npm, поэтому `pnpm-lock.yaml` монорепозитория не требуется изменять.
