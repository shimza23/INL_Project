import pickle
import sys

model = pickle.load(open("model.pkl", "rb"))

# ✅ If ONE input (old route)
if len(sys.argv) == 2:
    value = float(sys.argv[1])
    result = model.predict([[value, value]])  # simple fallback

# ✅ If TWO inputs (new route)
elif len(sys.argv) == 3:
    study_hours = float(sys.argv[1])
    attendance = float(sys.argv[2])
    result = model.predict([[study_hours, attendance]])

else:
    print("Invalid input")
    exit()

print(result[0])