import { ensureApiOk, fetchWithApiAuth } from "@/api/client";
import { recipeImageUri } from "@/api/recipes";
import { getApiBasicAuthorizationHeader } from "@/api/basicAuth";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Image,
  Platform,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
} from "react-native";

type Props = {
  imageUrl: string | null | undefined;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  placeholder: ReactNode;
};

/**
 * Loads recipe images from the API. When Basic Auth is configured, uses `Image` headers
 * on native; on web, fetches with Authorization and uses a blob URL (DOM img cannot send headers).
 */
export function RecipeRemoteImage({
  imageUrl,
  style,
  resizeMode = "cover",
  placeholder,
}: Props) {
  const uri = recipeImageUri(imageUrl);
  const auth = getApiBasicAuthorizationHeader();
  const [decodeFailed, setDecodeFailed] = useState(false);

  useEffect(() => {
    setDecodeFailed(false);
  }, [uri]);

  if (!uri || decodeFailed) return <>{placeholder}</>;

  if (Platform.OS === "web") {
    if (!auth) {
      return (
        <Image
          source={{ uri }}
          style={style}
          resizeMode={resizeMode}
          onError={() => setDecodeFailed(true)}
        />
      );
    }
    return (
      <RecipeRemoteImageWeb
        uri={uri}
        style={style}
        resizeMode={resizeMode}
        placeholder={placeholder}
      />
    );
  }

  const source = auth
    ? { uri, headers: { Authorization: auth } }
    : { uri };
  return (
    <Image
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={() => setDecodeFailed(true)}
    />
  );
}

function RecipeRemoteImageWeb({
  uri,
  style,
  resizeMode,
  placeholder,
}: {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode: ImageResizeMode;
  placeholder: ReactNode;
}) {
  const [blobUri, setBlobUri] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setBlobUri(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    fetchWithApiAuth(uri)
      .then(ensureApiOk)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancel) return;
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setBlobUri(url);
      })
      .catch(() => {
        if (!cancel) setBlobUri(null);
      });
    return () => {
      cancel = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [uri]);

  if (!blobUri) return <>{placeholder}</>;

  return (
    <Image
      source={{ uri: blobUri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        setBlobUri(null);
      }}
    />
  );
}
