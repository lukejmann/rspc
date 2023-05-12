import {
  createContext,
  ReactElement,
  useContext as _useContext,
  useEffect,
} from "react";
import {
  QueryClient,
  useQuery as __useQuery,
  useInfiniteQuery as __useInfiniteQuery,
  useMutation as __useMutation,
  UseQueryResult,
  UseQueryOptions,
  UseMutationResult,
  UseMutationOptions,
  UseInfiniteQueryResult,
  UseInfiniteQueryOptions,
  hashQueryKey,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  _inferProcedureHandlerInput,
  inferInfiniteQueries,
  _inferInfiniteQueryProcedureHandlerInput,
  inferInfiniteQueryResult,
  inferQueryInput,
  inferQueryResult,
  inferMutationResult,
  inferMutationInput,
  ProceduresDef,
  inferProcedureResult,
} from "@rspc/client";
import {
  AlphaClient,
  AlphaClientBuilder,
  AlphaRSPCError,
} from "@rspc/client/v2";

// TODO: Reuse one from client but don't export it in public API
type KeyAndInput = [string] | [string, any];

export interface BaseOptions<TProcedures extends ProceduresDef> {
  rspc?: {
    client?: AlphaClient<TProcedures>;
  };
}

export interface SubscriptionOptions<TOutput> {
  enabled?: boolean;
  onStarted?: () => void;
  onData: (data: TOutput) => void;
  // TODO: Not `| Error`
  onError?: (err: AlphaRSPCError | Error) => void;
}

export interface Context<TProcedures extends ProceduresDef> {
  client: AlphaClient<TProcedures>;
  queryClient: QueryClient;
}

// TODO: Share with SolidJS hooks if possible?
export type HooksOpts<P extends ProceduresDef> = {
  context: React.Context<Context<P>>;
};

type Args =
  | {
      client: AlphaClient<any>;
    }
  | {
      builder: AlphaClientBuilder<any>;
    };

export function createReactQueryRoot<A extends Args>(_args: A) {
  type P = A extends { client: AlphaClient<infer P> }
    ? P
    : A extends { builder: AlphaClientBuilder<infer P> }
    ? P
    : never;

  type BuilderSubClients<T extends AlphaClientBuilder<any>> =
    T["_subClients_def"];
  type ClientSubClients<T extends AlphaClient<any>> = T["_subClients_def"];

  type SubClients = (A extends {
    builder: AlphaClientBuilder<any>;
  }
    ? {
        [K in keyof BuilderSubClients<A["builder"]>]: BuilderSubClients<
          A["builder"]
        >[K] extends AlphaClientBuilder<any>
          ? BuilderSubClients<A["builder"]>[K]["_procedures_def"]
          : ProceduresDef;
      }
    : A extends {
        client: AlphaClient<any>;
      }
    ? {
        [K in keyof ClientSubClients<A["client"]>]: ClientSubClients<
          A["client"]
        >[K] extends AlphaClient<any>
          ? ClientSubClients<A["client"]>[K]["_procedures_def"]
          : ProceduresDef;
      }
    : {}) &
    Record<string, ProceduresDef>;

  const Context = createContext<Context<P> | undefined>(undefined);

  function useContext() {
    const ctx = _useContext(Context);

    if (!ctx)
      throw new Error(
        "The rspc context has not been set. Ensure you have the <rspc.Provider> component higher up in your component tree."
      );

    return ctx;
  }

  return {
    Provider: ({
      children,
      client,
      queryClient,
    }: {
      children?: ReactElement;
      client: AlphaClient<P>;
      queryClient: QueryClient;
    }) => (
      <Context.Provider
        value={{
          client,
          queryClient,
        }}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </Context.Provider>
    ),
    useContext,
    createHooks: <T extends keyof SubClients>(args?: { subClient?: T }) =>
      createHooks(() => {
        const ctx = useContext();

        if (args?.subClient)
          return {
            ...ctx,
            client: ctx.client.subClient(args.subClient),
          };
        else return useContext();
      }),
  };
}

function createHooks<P extends ProceduresDef>(useContext: () => Context<P>) {
  type TBaseOptions = BaseOptions<P>;

  function useQuery<
    K extends P["queries"]["key"] & string,
    TQueryFnData = inferQueryResult<P, K>,
    TData = inferQueryResult<P, K>
  >(
    keyAndInput: [
      key: K,
      ...input: _inferProcedureHandlerInput<P, "queries", K>
    ],
    opts?: Omit<
      UseQueryOptions<
        TQueryFnData,
        AlphaRSPCError,
        TData,
        [K, inferQueryInput<P, K>]
      >,
      "queryKey" | "queryFn"
    > &
      TBaseOptions
  ): UseQueryResult<TData, AlphaRSPCError> {
    const { rspc, ...rawOpts } = opts ?? {};

    const ctx = useContext();
    const client = rspc?.client ?? ctx.client;

    return __useQuery({
      queryKey: client._mapKeyAndInput(keyAndInput as any) as any,
      queryFn: async () => {
        return await client!.query(keyAndInput);
      },
      ...rawOpts,
    });
  }

  function useInfiniteQuery<K extends inferInfiniteQueries<P>["key"] & string>(
    keyAndInput: [
      key: K,
      ...input: _inferInfiniteQueryProcedureHandlerInput<P, K>
    ],
    opts?: Omit<
      UseInfiniteQueryOptions<
        inferInfiniteQueryResult<P, K>,
        AlphaRSPCError,
        inferInfiniteQueryResult<P, K>,
        inferInfiniteQueryResult<P, K>,
        [K, inferQueryInput<P, K>]
      >,
      "queryKey" | "queryFn"
    > &
      TBaseOptions
  ): UseInfiniteQueryResult<inferInfiniteQueryResult<P, K>, AlphaRSPCError> {
    const { rspc, ...rawOpts } = opts ?? {};

    const ctx = useContext();
    const client = rspc?.client ?? ctx.client;

    return __useInfiniteQuery({
      queryKey: client._mapKeyAndInput(keyAndInput as any) as any,
      queryFn: async () => {
        throw new Error("TODO"); // TODO: Finish this
      },
      ...(rawOpts as any),
    });
  }

  function useMutation<
    K extends P["mutations"]["key"] & string,
    TContext = unknown
  >(
    key: K | [K],
    opts?: UseMutationOptions<
      inferMutationResult<P, K>,
      AlphaRSPCError,
      inferMutationInput<P, K> extends never
        ? undefined
        : inferMutationInput<P, K>,
      TContext
    > &
      TBaseOptions
  ): UseMutationResult<
    inferMutationResult<P, K>,
    AlphaRSPCError,
    inferMutationInput<P, K> extends never
      ? undefined
      : inferMutationInput<P, K>,
    TContext
  > {
    const { rspc, ...rawOpts } = opts ?? {};

    const ctx = useContext();
    const client = rspc?.client ?? ctx.client;

    return __useMutation(async (input: any) => {
      const actualKey = Array.isArray(key) ? key[0] : key;
      return client!.mutation([actualKey, input] as any);
    }, rawOpts as any);
  }

  function useSubscription<
    K extends P["subscriptions"]["key"] & string,
    TData = inferProcedureResult<P, "subscriptions", K>
  >(
    keyAndInput: [
      key: K,
      ...input: _inferProcedureHandlerInput<P, "subscriptions", K>
    ],
    opts: SubscriptionOptions<TData> & TBaseOptions
  ) {
    const ctx = useContext();
    const client = opts?.rspc?.client ?? ctx.client;

    const queryKey = hashQueryKey(keyAndInput);
    const enabled = opts?.enabled ?? true;

    return useEffect(() => {
      if (!enabled) return;

      return client.addSubscription<K, TData>(keyAndInput, {
        onData: opts.onData,
        onError: opts.onError,
      });
    }, [queryKey, enabled]);
  }

  return {
    _rspc_def: undefined! as P, // This allows inferring the operations type from TS helpers
    useQuery,
    useInfiniteQuery,
    useMutation,
    useSubscription,
  };
}

export function createReactQueryHooks<P extends ProceduresDef>(
  client: AlphaClient<P>
) {
  const { createHooks, ...root } = createReactQueryRoot({
    client,
  });

  return {
    ...root,
    ...createHooks(),
  };
}
