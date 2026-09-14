# Greek ERP Starter

Initial foundation for a multi-tenant Greek ERP/e-invoicing SaaS.

## Included
- PostgreSQL + Prisma
- Multi-tenant organizations/users
- Customers and products
- Invoice series
- Draft invoices and immutable issued-state foundation
- Provider abstraction
- Transmission/audit tables
- Express API skeleton
- Redis container for later queues

## Start
```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm --workspace @erp/api run dev
```

## First milestone
1. Create an organization.
2. Create a customer.
3. Create a product/service.
4. Create an invoice series.
5. Create a DRAFT invoice.
6. Issue the invoice locally with atomic numbering.
7. Later plug a certified provider into `packages/providers`.
