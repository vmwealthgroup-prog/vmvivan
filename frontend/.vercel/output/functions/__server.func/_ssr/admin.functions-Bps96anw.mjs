import { n as createSsrRpc } from "./router-BXczp1V9.mjs";
import { fn as object, hn as string, in as _enum } from "../_libs/@better-auth/core+[...].mjs";
import { n as createServerFn } from "./ssr.mjs";
// node_modules/.nitro/vite/services/ssr/assets/admin.functions-Bps96anw.js
var requestSchema = object({
	email: string().trim().email().max(254),
	book: _enum([
		"nifty",
		"bank",
		"stocks",
		"all"
	])
});
var contactSchema = object({
	name: string().trim().max(120).default(""),
	email: string().trim().email().max(254),
	subject: string().trim().min(2).max(180).default("Website enquiry"),
	message: string().trim().min(2).max(8e3)
});
var reviewSchema = object({
	id: string().min(1).max(80),
	status: _enum(["approved", "rejected"])
});
var messageUpdateSchema = object({
	id: string().min(1).max(80),
	status: _enum([
		"unread",
		"read",
		"archived"
	]),
	note: string().max(4e3).default("")
});
var settingSchema = object({
	key: string().regex(/^[a-z][a-z0-9_.-]{1,60}$/),
	value: string().max(12e3)
});
var submitAccessRequest = createServerFn({ method: "POST" }).validator((v) => requestSchema.parse(v)).handler(createSsrRpc("1afe209bddf0aed74fe8004b162ec2a26790bface14978125f4c8e850fbb603f"));
var submitContactMessage = createServerFn({ method: "POST" }).validator((v) => contactSchema.parse(v)).handler(createSsrRpc("e1ecf6970aa959fb648c434b1c5905a82a4fd527f587e228671482c27cd781c1"));
var getAdminOverview = createServerFn({ method: "GET" }).handler(createSsrRpc("98193c088815d6bbdd4155ffbad4b125116e51df7ef81d3d6aef43156e028e01"));
var reviewAccessRequest = createServerFn({ method: "POST" }).validator((v) => reviewSchema.parse(v)).handler(createSsrRpc("6021c6f3d5e380711c469a62628fa5d6be80639b49b8fac4948c5397a040c5ac"));
var updateAdminMessage = createServerFn({ method: "POST" }).validator((v) => messageUpdateSchema.parse(v)).handler(createSsrRpc("ef5bd6931d7b0e2cf22ab047560cd30dda09320f4f03c51e6ea7dfe745c9cdc9"));
var saveSiteSetting = createServerFn({ method: "POST" }).validator((v) => settingSchema.parse(v)).handler(createSsrRpc("577af3b830e50b8f199745840eafa27d63f9d1fed22ed69667b996b63f90dc40"));
/** Public, read-only settings used by the marketing site. Never expose admin/audit data here. */
var getPublicSiteSettings = createServerFn({ method: "GET" }).handler(createSsrRpc("87d9e60c8b8d7fccc7a806c772c41f4ca903c529b4769c7eea7ae91707d350e7"));
export { submitAccessRequest as a, saveSiteSetting as i, getPublicSiteSettings as n, submitContactMessage as o, reviewAccessRequest as r, updateAdminMessage as s, getAdminOverview as t };
