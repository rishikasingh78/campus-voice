from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Any, Dict, List, Callable
import heapq
# =========================
# DATA MODELS
# =========================
@dataclass
class Patient:
	id: int
	name: str
	age: int
	severity: int = 0 # lower = more severe for emergency triage

@dataclass
class Doctor:
	id: int
	name: str
	specialization: str

class SlotStatus:
FREE = "FREE"
BOOKED = "BOOKED"
SERVED = "SERVED"
CANCELLED = "CANCELLED"
@dataclass
class Slot:
slot_id: int
start_time: str
end_time: str
status: str = SlotStatus.FREE
@dataclass
class Token:
token_id: int
patient_id: int
doctor_id: int
slot_id: int
token_type: str # "ROUTINE" or "EMERGENCY"
# =========================
# CIRCULAR QUEUE
# =========================
class CircularQueue:
"""
Circular queue for routine appointments.
Enqueue / Dequeue: O(1)
Special delete by predicate (for undo): O(n)
"""
def __init__(self, capacity: int):
self.capacity = capacity
self.data = [None] * capacity
self.front = 0
self.rear = -1
self.size = 0
def is_empty(self) -> bool:
return self.size == 0
def is_full(self) -> bool:
return self.size == self.capacity
def enqueue(self, item: Any):
if self.is_full():
raise OverflowError("Routine queue is full")
self.rear = (self.rear + 1) % self.capacity
self.data[self.rear] = item
self.size += 1
def dequeue(self) -> Any:
if self.is_empty():
raise IndexError("Routine queue is empty")
item = self.data[self.front]
self.data[self.front] = None
self.front = (self.front + 1) % self.capacity
self.size -= 1
return item
def peek(self) -> Any:
if self.is_empty():
def _iterate_items(self) -> List[Any]:
	"""Return current items in logical order."""
	items = []
	idx = self.front
	for _ in range(self.size):
		items.append(self.data[idx])
		idx = (idx + 1) % self.capacity
	return items
idx = (idx + 1) % self.capacity
return items
def remove_if(self, predicate: Callable[[Any], bool]) -> bool:
"""
Remove the first element that matches predicate.
Rebuilds the circular queue: O(n).
"""
if self.is_empty():
return False
items = self._iterate_items()
removed = False
new_items = []
for item in items:
if not removed and predicate(item):
removed = True
else:
new_items.append(item)
if not removed:
return False
# rebuild buffer
self.data = [None] * self.capacity
self.front = 0
self.rear = -1
self.size = 0
for it in new_items:
self.enqueue(it)
return True
def prepend(self, item: Any):
"""
Put one item logically at the front (used for undo Serve).
Rebuilds queue: O(n).
"""
items = self._iterate_items()
items.insert(0, item)
self.data = [None] * self.capacity
self.front = 0
self.rear = -1
self.size = 0
for it in items:
self.enqueue(it)
# =========================
# MIN-HEAP PRIORITY QUEUE
# =========================
class EmergencyPriorityQueue:
"""
Min-heap: (severity, counter, patient_id).
Insert / pop-min: O(log n)
Remove by patient_id (for undo): O(n) via rebuild.
"""
def __init__(self):
self.heap: List[tuple[int, int, int]] = []
self._counter = 0
def insert(self, patient_id: int, severity: int):
heapq.heappush(self.heap, (severity, self._counter, patient_id))
self._counter += 1
def pop_min(self) -> Optional[int]:
if not self.heap:
return None
severity, _, patient_id = heapq.heappop(self.heap)
return patient_id
def is_empty(self) -> bool:
return len(self.heap) == 0
def remove_patient(self, patient_id: int) -> bool:
"""Remove a given patient_id if present: O(n) with heapify."""
new_heap = []
removed = False
while self.heap:
severity, counter, pid = heapq.heappop(self.heap)
if not removed and pid == patient_id:
removed = True
else:
new_heap.append((severity, counter, pid))
if not removed:
# restore
self.heap = new_heap
else:
heapq.heapify(new_heap)
self.heap = new_heap
return removed
# =========================
# SINGLY LINKED LIST (SCHEDULE)
# =========================
class SlotNode:
def __init__(self, slot: Slot):
self.slot = slot
self.next: Optional[SlotNode] = None
class ScheduleList:
"""
Doctor's schedule as singly linked list.
Insert: O(1) at head
Convert to list / find: O(k)
"""
def __init__(self):
self.head: Optional[SlotNode] = None
def add_slot(self, slot: Slot):
node = SlotNode(slot)
node.next = self.head
self.head = node
def cancel_slot(self, slot_id: int) -> bool:
prev = None
curr = self.head
while curr:
if curr.slot.slot_id == slot_id:
if prev is None:
self.head = curr.next
else:
prev.next = curr.next
curr.slot.status = SlotStatus.CANCELLED
return True
prev = curr
curr = curr.next
return False
def find_next_free_slot(self) -> Optional[Slot]:
curr = self.head
best: Optional[Slot] = None
while curr:
if curr.slot.status == SlotStatus.FREE:
# pick earliest by slot_id just as a simple ordering
if best is None or curr.slot.slot_id < best.slot_id:
best = curr.slot
curr = curr.next
return best
def find_slot(self, slot_id: int) -> Optional[Slot]:
curr = self.head
while curr:
if curr.slot.slot_id == slot_id:
return curr.slot
curr = curr.next
return None
def to_list(self) -> List[Slot]:
res = []
curr = self.head
while curr:
res.append(curr.slot)
curr = curr.next
return res
# =========================
# STACK FOR UNDO
# =========================
@dataclass
class Action:
type: str # "BOOK_ROUTINE", "EMERGENCY_ADD", "SERVE_ROUTINE", "SERVE_EMERGENCY"
data: dict # extra info needed for undo
class UndoStack:
"""Standard LIFO stack."""
def __init__(self):
self._stack: List[Action] = []
def push(self, action: Action):
self._stack.append(action)
def pop(self) -> Optional[Action]:
if not self._stack:
return None
return self._stack.pop()
def is_empty(self) -> bool:
return len(self._stack) == 0
# =========================
# PATIENT INDEX (HASH TABLE)
# =========================
class PatientIndex:
"""
Hash table over patients using dict internally.
Insert / search: Avg O(1).
"""
def __init__(self):
self._table: Dict[int, Patient] = {}
def upsert(self, p: Patient):
self._table[p.id] = p
def get(self, pid: int) -> Optional[Patient]:
return self._table.get(pid)
def delete(self, pid: int):
self._table.pop(pid, None)
def all_patients(self) -> List[Patient]:
return list(self._table.values())
# =========================
# HOSPITAL SYSTEM
# =========================
class HospitalSystem:
"""
Integrates:
- CircularQueue for routine tokens
- Min-heap for emergency
- Linked lists for schedules
- Hash table for patients
- Stack for undo
"""
def __init__(self, routine_capacity: int = 100):
self.patients = PatientIndex()
self.doctors: Dict[int, Doctor] = {}
self.schedules: Dict[int, ScheduleList] = {}
self.routine_queue = CircularQueue(routine_capacity)
self.emergency_pq = EmergencyPriorityQueue()
self.undo_stack = UndoStack()
self.next_token_id = 1
self.served_tokens: List[Token] = []
self.token_index: Dict[int, Token] = {} # for quick lookup
# ---------- doctor & schedule ----------
def add_doctor(self, doc: Doctor):
self.doctors[doc.id] = doc
if doc.id not in self.schedules:
self.schedules[doc.id] = ScheduleList()
def add_slot_to_doctor(self, doctor_id: int, slot: Slot):
if doctor_id not in self.schedules:
self.schedules[doctor_id] = ScheduleList()
self.schedules[doctor_id].add_slot(slot)
def cancel_slot(self, doctor_id: int, slot_id: int) -> bool:
if doctor_id not in self.schedules:
return False
return self.schedules[doctor_id].cancel_slot(slot_id)
# ---------- patients ----------
def register_or_update_patient(self, patient: Patient):
self.patients.upsert(patient)
# ---------- internal helpers ----------
def _new_token(self, patient_id: int, doctor_id: int, slot_id: int, token_type: str) -> Token:
t = Token(
token_id=self.next_token_id,
patient_id=patient_id,
doctor_id=doctor_id,
slot_id=slot_id,
token_type=token_type
)
self.next_token_id += 1
self.token_index[t.token_id] = t
return t
# ---------- booking & emergency ----------
def book_routine(self, patient_id: int, doctor_id: int) -> Optional[Token]:
if doctor_id not in self.schedules:
print("Doctor not found or no schedule.")
return None
slot = self.schedules[doctor_id].find_next_free_slot()
if not slot:
print("No FREE slot for this doctor.")
return None
if self.routine_queue.is_full():
print("Routine queue is full.")
return None
slot.status = SlotStatus.BOOKED
token = self._new_token(patient_id, doctor_id, slot.slot_id, "ROUTINE")
self.routine_queue.enqueue(token)
# Log for undo
self.undo_stack.push(Action(
type="BOOK_ROUTINE",
data={
"token_id": token.token_id,
"doctor_id": doctor_id,
"slot_id": slot.slot_id
}
))
return token
def add_emergency(self, patient_id: int, severity: int):
self.emergency_pq.insert(patient_id, severity)
# also store severity on patient object if you want
p = self.patients.get(patient_id)
if p:
p.severity = severity
self.undo_stack.push(Action(
type="EMERGENCY_ADD",
data={
"patient_id": patient_id,
"severity": severity
}
))
# ---------- serving ----------
def serve_next(self) -> Optional[Token]:
"""
Emergency > Routine.
Emergency served as special token (doctor_id = -1, slot_id = -1).
"""
# emergency first
if not self.emergency_pq.is_empty():
pid = self.emergency_pq.pop_min()
token = self._new_token(pid, doctor_id=-1, slot_id=-1,
token_type="EMERGENCY")
self.served_tokens.append(token)
self.undo_stack.push(Action(
type="SERVE_EMERGENCY",
data={
"token_id": token.token_id,
"patient_id": pid
}
))
return token
# then routine
if self.routine_queue.is_empty():
print("No patients in any queue.")
return None
token = self.routine_queue.dequeue()
# mark its slot as served
if token.doctor_id in self.schedules:
slot = self.schedules[token.doctor_id].find_slot(token.slot_id)
if slot:
slot.status = SlotStatus.SERVED
self.served_tokens.append(token)
self.undo_stack.push(Action(
type="SERVE_ROUTINE",
data={
"token_id": token.token_id,
"doctor_id": token.doctor_id,
"slot_id": token.slot_id
}
))
return token
# ---------- undo operations (core feature) ----------
def undo_last(self):
action = self.undo_stack.pop()
if not action:
print("Nothing to undo.")
return
t = action.type
d = action.data
if t == "BOOK_ROUTINE":
self._undo_book_routine(d)
elif t == "EMERGENCY_ADD":
self._undo_emergency_add(d)
elif t == "SERVE_ROUTINE":
self._undo_serve_routine(d)
elif t == "SERVE_EMERGENCY":
self._undo_serve_emergency(d)
else:
print("Unknown action type, cannot undo.")
def _undo_book_routine(self, data: dict):
token_id = data["token_id"]
doctor_id = data["doctor_id"]
slot_id = data["slot_id"]
# 1. remove token from queue
removed = self.routine_queue.remove_if(lambda tok: tok and tok.token_id ==
token_id)
if not removed:
print("Undo failed: token not in routine queue anymore.")
return
# 2. mark slot back FREE
if doctor_id in self.schedules:
slot = self.schedules[doctor_id].find_slot(slot_id)
if slot and slot.status == SlotStatus.BOOKED:
slot.status = SlotStatus.FREE
# token_index can remain (or you can delete it)
print(f"Undid booking of token {token_id}")
def _undo_emergency_add(self, data: dict):
pid = data["patient_id"]
removed = self.emergency_pq.remove_patient(pid)
if not removed:
print("Undo failed: emergency patient already served or not found.")
return
print(f"Undid emergency registration of patient {pid}")
def _undo_serve_routine(self, data: dict):
token_id = data["token_id"]
doctor_id = data["doctor_id"]
slot_id = data["slot_id"]
token = self.token_index.get(token_id)
if not token or token not in self.served_tokens:
print("Undo failed: served token not found.")
return
# 1. remove from served list
self.served_tokens.remove(token)
# 2. revert slot state back to BOOKED (it was SERVED)
if doctor_id in self.schedules:
slot = self.schedules[doctor_id].find_slot(slot_id)
if slot and slot.status == SlotStatus.SERVED:
slot.status = SlotStatus.BOOKED
# 3. put token back at front of routine queue
self.routine_queue.prepend(token)
print(f"Undid serving of routine token {token_id}")
def _undo_serve_emergency(self, data: dict):
token_id = data["token_id"]
pid = data["patient_id"]
token = self.token_index.get(token_id)
if not token or token not in self.served_tokens:
print("Undo failed: served emergency token not found.")
return
# remove from served list
self.served_tokens.remove(token)
# re-insert into emergency PQ with its previous severity
p = self.patients.get(pid)
severity = p.severity if p else 0
self.emergency_pq.insert(pid, severity)
print(f"Undid serving of emergency patient {pid}")
# ---------- reports / analytics ----------
def report_per_doctor(self):
def report_per_doctor(self):
	print("\n--- Per Doctor Status ---")
	for did, doc in self.doctors.items():
if not sched:
print(f"Doctor {did} ({doc.name}): No schedule")
continue
slots = sched.to_list()
free = sum(1 for s in slots if s.status == SlotStatus.FREE)
booked = sum(1 for s in slots if s.status == SlotStatus.BOOKED)
served = sum(1 for s in slots if s.status == SlotStatus.SERVED)
print(f"Doctor {did} ({doc.name}): FREE={free}, BOOKED={booked},
SERVED={served}")
def report_queue_summary(self):
print("\n--- Queue Summary ---
def report_queue_summary(self):
	print("\n--- Queue Summary ---")
	print(f"Routine queue pending: {self.routine_queue.size}")
def top_k_frequent_patients(self, k: int) -> List[tuple[int, int]]:
"""
Return list of (patient_id, count) for top-k by visit count.
Time: O(n log n) with sort or O(n log k) using heap.
"""
freq: Dict[int, int] = {}
for token in self.served_tokens:
freq[token.patient_id] = freq.get(token.patient_id, 0) + 1
# use heap of size k
heap: List[tuple[int, int]] = []
for pid, count in freq.items():
if len(heap) < k:
heapq.heappush(heap, (count, pid))
else:
if count > heap[0][0]:
heapq.heapreplace(heap, (count, pid))
result = sorted([(pid, count) for count, pid in heap], key=lambda x: -x[1])
return result
def search_patients_by_name(self, keyword: str) -> List[Patient]:
"""
Linear search on hash table values: O(n).
"""
keyword = keyword.lower()
return [p for p in self.patients.all_patients() if keyword in p.name.lower()]
# =========================
# SIMPLE DEMO / CLI
# =========================
def demo_menu():
system = HospitalSystem(routine_capacity=10)
# sample doctors & slots
system.add_doctor(Doctor(1, "Dr. Sharma", "Cardiology"))
system.add_doctor(Doctor(2, "Dr. Gupta", "Orthopedics"))
system.add_slot_to_doctor(1, Slot(101, "10:00", "10:15"))
system.add_slot_to_doctor(1, Slot(102, "10:15", "10:30"))
system.add_slot_to_doctor(2, Slot(201, "11:00", "11:15"))
while True:
print("\n==== Hospital Menu ====")
print("1. Register/Update Patient")
print("2. Book Routine Appointment")
print("3. Add Emergency Patient")
print("4. Serve Next Patient")
print("5. Undo Last Operation")
print("6. Reports (Doctors & Queues)")
print("7. Top-K Frequent Patients")
print("8. Search Patient by Name")
print("0. Exit")
ch = input("Enter choice: ").strip()
if ch == "1":
pid = int(input("Patient ID: "))
name = input("Name: ")
age = int(input("Age: "))
severity = int(input("Severity (0 if normal): "))
system.register_or_update_patient(Patient(pid, name, age, severity))
elif ch == "2":
pid = int(input("Patient ID: "))
did = int(input("Doctor ID: "))
tok = system.book_routine(pid, did)
if tok:
print("Booked:", tok)
elif ch == "3":
pid = int(input("Patient ID: "))
severity = int(input("Severity (lower = more severe): "))
system.add_emergency(pid, severity)
print("Emergency patient added.")
elif ch == "4":
tok = system.serve_next()
if tok:
print("Served:", tok)
elif ch == "5":
system.undo_last()
elif ch == "6":
system.report_per_doctor()
system.report_queue_summary()
elif ch == "7":
k = int(input("Enter K: "))
topk = system.top_k_frequent_patients(k)
print("Top-K frequent patients (id, count):", topk)
elif ch == "8":
kw = input("Name contains: ")
res = system.search_patients_by_name(kw)
for p in res:
print(f"{p.id} - {p.name} (age {p.age})")
elif ch == "0":
break
else:
print("Invalid choice.")
if __name__ == "__main__":
demo_menu()