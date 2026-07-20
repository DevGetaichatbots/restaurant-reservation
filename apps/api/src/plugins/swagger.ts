import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

/**
 * API documentation, generated from the route schemas themselves.
 *
 * Because every route already declares its shape in Zod for validation, that
 * same declaration produces the OpenAPI document — so the docs cannot drift
 * from the implementation. This satisfies the "documented" acceptance
 * criterion in Task 1 with no separate writing effort.
 *
 * Browsable at /docs while the server is running.
 */
export default fp(async function swaggerPlugin(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Restaurant Reservation API",
        description:
          "Shared backend for the guest booking page, admin dashboard and staff tablet.",
        version: "0.1.0",
      },
      tags: [
        { name: "health", description: "Service liveness" },
        { name: "tables", description: "Table inventory" },
        { name: "availability", description: "What a guest can actually book" },
        { name: "reservations", description: "Bookings and their status" },
        { name: "requests", description: "Bookings awaiting a human decision" },
        { name: "settings", description: "Opening hours, slots, rules, capacity" },
        { name: "realtime", description: "Server-sent event stream" },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
});
