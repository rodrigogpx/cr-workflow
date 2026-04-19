-- Add signatureResponsibleName field to tenants table
ALTER TABLE tenants ADD COLUMN signature_responsible_name VARCHAR(255);
