import type { DocType } from "../doc-types/doc-type.js";
import { AttachmentService } from "./attachment.service.js";
import { SupabaseAttachmentStorageProvider } from "./attachment.storage.js";
import { createAttachmentRouter } from "./attachment.routes.js";

export const attachmentDocType: DocType = {
  name: "attachments",
  route: "/attachments",
  permissions: [
    { code: "attachments:read", name: "Read attachments" },
    { code: "attachments:create", name: "Create attachments" },
  ],
  register(dependencies) {
    const storage = new SupabaseAttachmentStorageProvider(dependencies.config.SUPABASE_URL, dependencies.config.SUPABASE_SERVICE_ROLE_KEY, dependencies.config.ATTACHMENTS_BUCKET);
    const service = new AttachmentService(dependencies.prisma, storage);
    return { api: service, router: createAttachmentRouter(dependencies.tokenVerifier, dependencies.userRepository, service, dependencies.config.ATTACHMENTS_SIGNED_URL_SECONDS) };
  },
};