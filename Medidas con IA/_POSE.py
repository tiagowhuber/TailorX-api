#%%
import cv2
import mediapipe as mp
import pandas as pd
from mediapipe.framework.formats import landmark_pb2
import numpy as np

# Inicializar MediaPipe Pose
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5)

# Leer imagen
image = cv2.imread(r"D:\Archivo_Proyectos\Repositorios\TailorX-api\Medidas con IA\persona.png")
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


#%%
# Procesar la imagen con MediaPipe Pose
results = pose.process(image_rgb)

# Verificar si se detectó una persona
if not results.pose_landmarks:
    print("No se detectó ninguna pose en la imagen.")
else:
    landmarks = results.pose_landmarks.landmark
    # Diccionario de landmarks de interés
    LANDMARKS_INTERES = [
            mp_pose.PoseLandmark.NOSE,
            mp_pose.PoseLandmark.LEFT_EAR,
            mp_pose.PoseLandmark.RIGHT_EAR,
            mp_pose.PoseLandmark.LEFT_SHOULDER,
            mp_pose.PoseLandmark.RIGHT_SHOULDER,
            mp_pose.PoseLandmark.LEFT_ELBOW,
            mp_pose.PoseLandmark.RIGHT_ELBOW,
            mp_pose.PoseLandmark.LEFT_WRIST,
            mp_pose.PoseLandmark.RIGHT_WRIST,
            mp_pose.PoseLandmark.LEFT_HIP,
            mp_pose.PoseLandmark.RIGHT_HIP,
            mp_pose.PoseLandmark.LEFT_KNEE,
            mp_pose.PoseLandmark.RIGHT_KNEE,
            mp_pose.PoseLandmark.LEFT_ANKLE,
            mp_pose.PoseLandmark.RIGHT_ANKLE
        ]

    #%%
    # Extraer los datos en un formato legible
    datos_pose = []
    for p in LANDMARKS_INTERES:
        l = landmarks[p.value]
        datos_pose.append({ 
            "Landmark": p.name,
            "POS": np.array([l.x,l.y,l.z]),
            "Visibilidad": l.visibility
        })

    # Convertir a DataFrame para visualizar o guardar
    df = pd.DataFrame(datos_pose)
    print(df)
    # Guardar a CSV (opcional)
    df.to_csv(r"D:\Archivo_Proyectos\Repositorios\TailorX-api\Medidas con IA\landmarks_filtrados.csv", index=False)
    print("Landmarks guardados en landmarks_filtrados.csv")
    
    #%%
    # Dibujar los landmarks sobre la imagen original
    pose_landmarks_filtrados = landmark_pb2.NormalizedLandmarkList()
    for idx in LANDMARKS_INTERES:
        pose_landmarks_filtrados.landmark.append(results.pose_landmarks.landmark[idx.value])

        # --- Dibujar solo landmarks filtrados ---
    annotated_image = image.copy()
    mp_drawing.draw_landmarks(
        annotated_image,
        pose_landmarks_filtrados,
        connections=None,  # no dibujamos conexiones automáticas
        landmark_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=3),
    )

    # Mostrar el resultado
    cv2.imshow('Pose detectada', annotated_image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    # Guardar imagen de salida
    cv2.imwrite("pose_detectada.jpg", annotated_image)
    print("Imagen guardada como pose_detectada.jpg")

# %%
