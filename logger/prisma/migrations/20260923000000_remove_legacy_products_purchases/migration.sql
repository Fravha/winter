DO $$
DECLARE
  products_count bigint;
  purchases_count bigint;
  purchase_lines_count bigint;
BEGIN
  SELECT count(*) INTO products_count FROM "products";
  SELECT count(*) INTO purchases_count FROM "purchases";
  SELECT count(*) INTO purchase_lines_count FROM "purchase_lines";

  IF products_count > 0 OR purchases_count > 0 OR purchase_lines_count > 0 THEN
    RAISE EXCEPTION
      'Legacy cleanup aborted: products=%, purchases=%, purchase_lines=%; export or explicitly resolve these rows before applying this migration.',
      products_count,
      purchases_count,
      purchase_lines_count;
  END IF;
END
$$;

DELETE FROM "permissions"
WHERE "code" IN (
  'products:read',
  'products:create',
  'products:update',
  'products:delete',
  'purchases:read',
  'purchases:create',
  'purchases:update',
  'purchases:delete'
);

DROP TABLE "purchase_lines";
DROP TABLE "purchases";
DROP TABLE "products";