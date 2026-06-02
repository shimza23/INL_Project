
from sklearn.linear_model import LinearRegression
import numpy as np
import pickle

# [study hours, attendance]
X = np.array([
    [1, 50],
    [2, 60],
    [3, 70],
    [4, 80],
    [5, 90]
])

# marks
y = np.array([40, 50, 60, 75, 90])

model = LinearRegression()
model.fit(X, y)

pickle.dump(model, open("model.pkl", "wb"))

print("✅ New model trained")
