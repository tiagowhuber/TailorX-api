#%%
import cv2
import mediapipe as mp
import pandas as pd
from mediapipe.framework.formats import landmark_pb2
import numpy as np

df = pd.read_csv(r"D:\Archivo_Proyectos\Repositorios\TailorX-api\Medidas con IA\landmarks_filtrados.csv")

def CalculateDistance(p1,p2,v1,v2):
    dist = np.linalg.norm(p1 - p2)
    vis = (v1 + v2) / 2
    return dist, vis

DIST_HOMBROS_REAL = 38 #cm
DIST_HOMBROS_EST, VIS_HOMBROS = CalculateDistance(
    np.fromstring(df.loc[df['Landmark'] == 'LEFT_SHOULDER', 'POS'].values[0].strip("[]"), sep=' '),
    np.fromstring(df.loc[df['Landmark'] == 'RIGHT_SHOULDER', 'POS'].values[0].strip("[]"), sep=' '),
    df.loc[df['Landmark'] == 'LEFT_SHOULDER', 'Visibilidad'].values[0],
    df.loc[df['Landmark'] == 'RIGHT_SHOULDER', 'Visibilidad'].values[0]
)

print(f"Distancia hombros estimada: {DIST_HOMBROS_EST} con visibilidad {VIS_HOMBROS}")

SCALE_FACTOR = DIST_HOMBROS_REAL / DIST_HOMBROS_EST

DIST_HOMBROCODO_EST, VIS_HOMBROCODO = CalculateDistance(
    np.fromstring(df.loc[df['Landmark'] == 'LEFT_SHOULDER', 'POS'].values[0].strip("[]"), sep=' '),
    np.fromstring(df.loc[df['Landmark'] == 'LEFT_ELBOW', 'POS'].values[0].strip("[]"), sep=' '),
    df.loc[df['Landmark'] == 'LEFT_SHOULDER', 'Visibilidad'].values[0],
    df.loc[df['Landmark'] == 'LEFT_ELBOW', 'Visibilidad'].values[0]
)   

DIST_HOMBROCODO_REAL = DIST_HOMBROCODO_EST * SCALE_FACTOR
print(f"Distancia hombro-codo estimada: {DIST_HOMBROCODO_REAL} con visibilidad {VIS_HOMBROCODO}")# %%
