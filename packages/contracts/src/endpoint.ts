import { z } from 'zod';
import type { Schema } from './dto.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type Segment<S extends string> = S extends `:${infer Name}` ? Name : never;
type Segments<P extends string> = P extends `${infer Head}/${infer Tail}` ? Segment<Head> | Segments<Tail> : Segment<P>;
export type PathParams<P extends string> = [Segments<P>] extends [never] ? Record<string, never> : { [K in Segments<P>]: string };

export interface EndpointSpec<
  M extends HttpMethod = HttpMethod,
  P extends string = string,
  Params extends Schema | undefined = Schema | undefined,
  Query extends Schema | undefined = Schema | undefined,
  Body extends Schema | undefined = Schema | undefined,
  Res extends Schema = Schema
> {
  method: M;
  path: P;
  summary: string;
  tags: readonly string[];
  auth: 'public' | 'user' | 'admin' | 'service';
  scopes?: readonly string[];
  params?: Params;
  query?: Query;
  body?: Body;
  response: Res;
  status?: number;
  raw?: boolean;
}

export const defineEndpoint = <
  const M extends HttpMethod,
  const P extends string,
  Res extends Schema,
  Params extends Schema | undefined = undefined,
  Query extends Schema | undefined = undefined,
  Body extends Schema | undefined = undefined
>(
  spec: EndpointSpec<M, P, Params, Query, Body, Res>
) => spec;

export type AnyEndpoint = EndpointSpec<HttpMethod, string, Schema | undefined, Schema | undefined, Schema | undefined, Schema>;

type InferOr<S, Fallback> = [S] extends [Schema] ? z.output<S> : Fallback;
type InputOr<S, Fallback> = [S] extends [Schema] ? z.input<S> : Fallback;

type ParamsOf<E> = E extends EndpointSpec<HttpMethod, string, infer S, Schema | undefined, Schema | undefined, Schema> ? S : undefined;
type QueryOf<E> = E extends EndpointSpec<HttpMethod, string, Schema | undefined, infer S, Schema | undefined, Schema> ? S : undefined;
type BodyOf<E> = E extends EndpointSpec<HttpMethod, string, Schema | undefined, Schema | undefined, infer S, Schema> ? S : undefined;

export type EndpointParams<E extends AnyEndpoint> = InferOr<ParamsOf<E>, PathParams<E['path']>>;
export type EndpointQuery<E extends AnyEndpoint> = InferOr<QueryOf<E>, Record<string, never>>;
export type EndpointBody<E extends AnyEndpoint> = InferOr<BodyOf<E>, undefined>;
export type EndpointResponse<E extends AnyEndpoint> = z.output<E['response']>;

type OptionalKeys<T> = { [K in keyof T]: undefined extends T[K] ? K : Record<string, never> extends T[K] ? K : never }[keyof T];
type Compact<T> = Omit<T, OptionalKeys<T>> & Partial<Pick<T, OptionalKeys<T>>>;

export type EndpointRequest<E extends AnyEndpoint> = Compact<{
  params: InputOr<ParamsOf<E>, PathParams<E['path']>>;
  query: InputOr<QueryOf<E>, Record<string, never>>;
  body: InputOr<BodyOf<E>, undefined>;
}>;

export const buildPath = (path: string, params: Record<string, unknown> | undefined): string =>
  path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === null) throw new Error(`Missing path parameter "${name}" for ${path}`);
    return encodeURIComponent(String(value));
  });

export const buildQuery = (query: Record<string, unknown> | undefined): string => {
  if (!query) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};
