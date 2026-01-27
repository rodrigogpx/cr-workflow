-- Migration: Add emailLogoUrl column to tenants table
-- This column stores the URL of the logo image downloaded from the club's website
-- The logo can be used in email templates via the {{logo}} variable

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "emailLogoUrl" TEXT;
